import { useEffect, useState, useRef } from "react";
import axios from "axios";

// 1. Dynamic URL Setup
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function Chat({ user, setUser }) {
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const messagesEndRef = useRef(null);

  // Load users and rooms once on mount
  useEffect(() => {
    loadUsers();
    loadRooms();
    
    // Optional: Refresh the user/room list every 10 seconds to see new signups
    const listInterval = setInterval(() => {
      loadUsers();
      loadRooms();
    }, 10000);
    
    return () => clearInterval(listInterval);
  }, []);

  const loadUsers = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/users`);
      setUsers(res.data.filter(u => u.email !== user.email));
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const loadRooms = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/rooms`);
      setRooms(res.data);
    } catch (err) {
      console.error("Error loading rooms:", err);
    }
  };

  // --- NEW: POLLING LOGIC ---
  // This replaces the Socket listeners. It asks the server for new messages every 3 seconds.
  useEffect(() => {
    if (!currentChat || !user?.email) return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `${BACKEND_URL}/messages/${currentChat.type}/${currentChat.id}?me=${user.email}`
        );
        
        // Only update state if the number of messages has actually changed
        // This prevents the screen from flickering/re-rendering constantly
        setMessages((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(res.data)) {
                return res.data;
            }
            return prev;
        });
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    fetchMessages(); // Run once immediately when a chat is selected
    const interval = setInterval(fetchMessages, 3000); // Repeat every 3 seconds

    return () => clearInterval(interval); // Stop polling when user switches chat or logs out
  }, [currentChat, user.email]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectPrivateChat = (u) => {
    setCurrentChat({ type: "private", id: u.email, name: u.name });
    setMessages([]); // Clear chat screen while loading new messages
  };

  const selectRoomChat = (r) => {
    if (!r.members.includes(user.email)) {
      alert("You are not a member of this room. Request to join first.");
      return;
    }
    setCurrentChat({ type: "room", id: r.name, name: r.name });
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!text && !file) return;

    let filePath = "";
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${BACKEND_URL}/upload`, fd);
      filePath = res.data.path;
      setFile(null);
    }

    const msgData = {
      senderEmail: user.email,
      senderName: user.name,
      receiver: currentChat.id,
      text,
      file: filePath,
      isRoom: currentChat.type === "room"
    };

    try {
      // Send message to database via API
      await axios.post(`${BACKEND_URL}/messages`, msgData);
      
      // Optimistic UI update: show the message immediately so it doesn't "disappear"
      setMessages(prev => [...prev, { ...msgData, time: new Date() }]);
      setText("");
    } catch (err) {
      alert("Failed to send message. Please try again.");
    }
  };

  const logout = () => {
    localStorage.removeItem("chatUser");
    setUser(null);
  };

  const createRoom = async () => {
    const name = prompt("Enter room name:");
    if (!name) return;
    try {
        await axios.post(`${BACKEND_URL}/createRoom`, { name, creator: user.email });
        loadRooms(); // Refresh the room list immediately
    } catch (err) {
        alert("Error creating room.");
    }
  };

  const requestJoin = async (r) => {
  try {
    await axios.post(`${BACKEND_URL}/requestJoinRoom`, { 
      roomName: r.name, 
      email: user.email 
    });
    
    // IMPORTANT: Refresh the room list so the button changes state 
    // or shows "Pending"
    await loadRooms(); 
    alert("Request sent to the room creator!");
  } catch (err) {
    alert("Failed to send request.");
  }
};

const approveJoin = async (roomName, email) => {
  try {
    await axios.post(`${BACKEND_URL}/approveJoin`, { roomName, email });
    // Refresh list so the user disappears from "Pending" and joins "Members"
    await loadRooms(); 
  } catch (err) {
    alert("Failed to approve user.");
  }
};
  const deleteRoom = async (roomName) => {
    if (window.confirm("Delete room?")) {
      await axios.delete(`${BACKEND_URL}/deleteRoom/${roomName}`);
      loadRooms();
      if (currentChat?.id === roomName) setCurrentChat(null);
    }
  };

  const hasRequested = (room) => room.joinRequests.includes(user.email);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: "25%", background: "#f0f2f5", padding: "10px", overflowY: "auto" }}>
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontWeight: "bold" }}>{user.name}</div>
          <button onClick={logout} style={{ padding: "5px 10px", marginTop: "5px" }}>Logout</button>
        </div>

        <div>
          <h4>Users</h4>
          {users.map(u => (
            <div key={u.email} onClick={() => selectPrivateChat(u)} style={{ padding: "5px", cursor: "pointer", display: "flex", alignItems: "center", background: currentChat?.id === u.email ? "#e6effb" : "transparent" }}>
              {u.avatar && <img src={`${BACKEND_URL}${u.avatar}`} alt="" style={{ width: "25px", height: "25px", borderRadius: "50%", marginRight: "5px" }} />}
              {u.name}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "20px" }}>
          <h4>
            Rooms <button onClick={createRoom}>+</button>
          </h4>
          {rooms.map(r => (
  <div key={r.name} style={{ padding: "10px", borderBottom: "1px solid #ddd", background: currentChat?.id === r.name ? "#e6effb" : "transparent" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span 
        style={{ cursor: "pointer", fontWeight: "bold", color: "#075e54" }} 
        onClick={() => selectRoomChat(r)}
      >
        # {r.name}
      </span>
      {r.creator === user.email && (
        <button onClick={() => deleteRoom(r.name)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "12px" }}>🗑️</button>
      )}
    </div>

    {/* 👑 Show Room Creator */}
    <div style={{ fontSize: "11px", color: "#555", marginTop: "5px" }}>
      <strong>Created by:</strong> {r.creator === user.email ? "You" : r.creator.split('@')[0]}
    </div>

    {/* 👥 List of Members */}
    <div style={{ fontSize: "11px", color: "#555", marginTop: "5px" }}>
      <strong>Members:</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "3px" }}>
        {r.members.map((mEmail) => (
          <span 
            key={mEmail} 
            style={{ 
              background: "#dcf8c6", 
              padding: "2px 6px", 
              borderRadius: "8px", 
              fontSize: "10px",
              border: "1px solid #c5e1a5"
            }}
          >
            {mEmail === user.email ? "Me" : mEmail.split('@')[0]}
          </span>
        ))}
      </div>
    </div>

    {/* Request Join Logic (Keep this) */}
    {!r.members.includes(user.email) && !hasRequested(r) && (
      <button style={{ marginTop: "8px", width: "100%", fontSize: "11px", padding: "4px" }} onClick={() => requestJoin(r)}>Request to Join</button>
    )}
    {hasRequested(r) && !r.members.includes(user.email) && (
      <div style={{ marginTop: "8px", fontSize: "11px", color: "orange", fontStyle: "italic" }}>Pending Approval...</div>
    )}

    {/* Approval section for Creator (Keep this) */}
    {r.creator === user.email && r.joinRequests.length > 0 && (
      <div style={{ marginTop: "10px", padding: "5px", background: "#fff", borderRadius: "5px", border: "1px dashed #ccc" }}>
        <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "5px" }}>New Requests:</div>
        {r.joinRequests.map(req => (
          <div key={req} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
            <span style={{ fontSize: "10px" }}>{req.split('@')[0]}</span>
            <button style={{ fontSize: "9px", padding: "2px 5px" }} onClick={() => approveJoin(r.name, req)}>Approve</button>
          </div>
        ))}
      </div>
    )}
  </div>
))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
        <div style={{ padding: "15px", borderBottom: "1px solid #ccc", fontWeight: "bold", background: "#f0f2f5" }}>
          {currentChat ? `Chatting with: ${currentChat.name}` : "Select a user or room to start chatting"}
        </div>
        
        <div style={{ flex: 1, padding: "10px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {messages.map((m, i) => {
            const isMe = m.senderEmail === user.email;
            return (
              <div key={i} style={{ alignSelf: isMe ? "flex-end" : "flex-start", marginBottom: "10px", maxWidth: "70%" }}>
                <div style={{
                  background: isMe ? "#dcf8c6" : "#f0f0f0",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  boxShadow: "0 1px 1px rgba(0,0,0,0.1)"
                }}>
                  {currentChat?.type === "room" && !isMe && (
                    <div style={{ fontWeight: "bold", fontSize: "11px", color: "#075e54", marginBottom: "3px" }}>{m.senderName}</div>
                  )}
                  {m.text && <div style={{ wordBreak: "break-word" }}>{m.text}</div>}
                  {m.file && (
                    <div style={{ marginTop: "5px" }}>
                        <a href={`${BACKEND_URL}${m.file}`} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#34b7f1" }}>📎 View File</a>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "9px", color: "#999", textAlign: isMe ? "right" : "left", marginTop: "2px" }}>
                    {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef}></div>
        </div>

        {currentChat && (
            <div style={{ display: "flex", padding: "15px", borderTop: "1px solid #ccc", background: "#f0f2f5" }}>
              <input 
                type="text" 
                placeholder="Type a message..." 
                value={text} 
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                onChange={e => setText(e.target.value)} 
                style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #ccc" }} 
              />
              <label style={{ cursor: "pointer", padding: "10px" }}>
                📁
                <input type="file" onChange={e => setFile(e.target.files[0])} style={{ display: "none" }} />
              </label>
              <button onClick={sendMessage} style={{ marginLeft: "5px", padding: "10px 20px", borderRadius: "20px", border: "none", background: "#075e54", color: "white", cursor: "pointer" }}>
                Send
              </button>
            </div>
        )}
      </div>
    </div>
  );
}

export default Chat;