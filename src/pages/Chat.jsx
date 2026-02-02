// src/Chat.jsx
import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:5000");

function Chat({ user, setUser }) {
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentChat, setCurrentChat] = useState(null); // {type: 'private'|'room', id, name}
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const messagesEndRef = useRef(null);

  // Load users and rooms
  useEffect(() => {
    loadUsers();
    loadRooms();
  }, []);

  const loadUsers = async () => {
    const res = await axios.get("http://localhost:5000/users");
    setUsers(res.data.filter(u => u.email !== user.email));
  };

  const loadRooms = async () => {
    const res = await axios.get("http://localhost:5000/rooms");
    setRooms(res.data);
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Socket listeners
// src/Chat.jsx

useEffect(() => {
  // 1. SAFETY CHECK: If user is not logged in yet, don't start listeners
  if (!user || !user.email) return;

  // --- EXISTING FUNCTIONALITY (Old Messages) ---
  socket.on("oldPrivateMessages", msgs => setMessages(msgs));
  socket.on("oldRoomMessages", msgs => setMessages(msgs));

  // --- EXISTING FUNCTIONALITY (Incoming Messages) ---
  socket.on("privateMessage", msg => {
    if (currentChat?.type === "private" && (msg.senderEmail === currentChat.id || msg.receiver === currentChat.id)) {
      setMessages(prev => [...prev, msg]);
    }
  });

  socket.on("roomMessage", msg => {
    if (currentChat?.type === "room" && msg.receiver === currentChat.id) {
      setMessages(prev => [...prev, msg]);
    }
  });

  // --- NEW LIVE UPDATES (Users & Rooms) ---
  socket.on("newUserRegistered", (newUser) => {
    // 2. CHECK: Only add if user exists and it's not the current logged-in user
    if (user && newUser.email !== user.email) {
      setUsers((prev) => {
        const exists = prev.find(u => u.email === newUser.email);
        return exists ? prev : [...prev, newUser];
      });
    }
  });

  socket.on("newRoomCreated", (newRoom) => {
    setRooms((prev) => {
      const exists = prev.find(r => r.name === newRoom.name);
      return exists ? prev : [...prev, newRoom];
    });
  });

  socket.on("requestUpdate", () => {
    loadRooms(); 
  });

  socket.on("roomUpdated", ({ roomName, members }) => {
    setRooms(prevRooms => 
      prevRooms.map(r => 
        r.name === roomName ? { ...r, members, joinRequests: r.joinRequests?.filter(req => !members.includes(req)) || [] } : r
      )
    );
  });

  // --- CLEANUP ---
  return () => {
    socket.off("oldPrivateMessages");
    socket.off("oldRoomMessages");
    socket.off("privateMessage");
    socket.off("roomMessage");
    socket.off("newUserRegistered");
    socket.off("newRoomCreated");
    socket.off("requestUpdate");
    socket.off("roomUpdated");
  };
}, [currentChat, user]); // Watch the whole user object for safety

  // --- Chat selection ---
  const selectPrivateChat = (u) => {
    setCurrentChat({ type: "private", id: u.email, name: u.name });
    setMessages([]);
    socket.emit("joinPrivate", { me: user.email, other: u.email });
  };

  const selectRoomChat = (r) => {
    if (!r.members.includes(user.email)) {
      alert("You are not a member of this room. Request to join first.");
      return;
    }
    setCurrentChat({ type: "room", id: r.name, name: r.name });
    setMessages([]);
    socket.emit("joinRoom", { room: r.name, email: user.email });
  };

  // --- Send message ---
  const sendMessage = async () => {
    if (!text && !file) return;

    let filePath = "";
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post("http://localhost:5000/upload", fd);
      filePath = res.data.path;
      setFile(null);
    }

    const msg = {
      senderEmail: user.email,
      senderName: user.name,
      receiver: currentChat.id,
      text,
      file: filePath,
    };

    if (currentChat.type === "private") {
      socket.emit("privateMessage", msg);
    } else {
      msg.room = currentChat.id;
      socket.emit("roomMessage", msg);
    }
    setText("");
  };

  // --- Logout ---
  const logout = () => {
    localStorage.removeItem("chatUser");
    setUser(null);
  };

  // --- Room functions ---
  const createRoom = async () => {
    const name = prompt("Enter room name:");
    if (!name) return;
    await axios.post("http://localhost:5000/createRoom", { name, creator: user.email });
    loadRooms();
  };

  // Request to join room
const requestJoin = async (r) => {
  await axios.post("http://localhost:5000/requestJoinRoom", { roomName: r.name, email: user.email });
  // Reload rooms so creator sees pending requests
  loadRooms();
  alert("Request sent to the room creator");
};


  const approveJoin = async (roomName, email) => {
    await axios.post("http://localhost:5000/approveJoin", { roomName, email });
    loadRooms();
  };

  const deleteRoom = async (roomName) => {
    if (window.confirm("Delete room?")) {
      await axios.delete(`http://localhost:5000/deleteRoom/${roomName}`);
      loadRooms();
      if (currentChat?.id === roomName) setCurrentChat(null);
    }
  };

  // --- Helper to check if user has requested to join ---
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
            <div key={u.email} onClick={() => selectPrivateChat(u)} style={{ padding: "5px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              {u.avatar && <img src={`http://localhost:5000${u.avatar}`} alt="" style={{ width: "25px", height: "25px", borderRadius: "50%", marginRight: "5px" }} />}
              {u.name}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "20px" }}>
          <h4>
            Rooms <button onClick={createRoom}>+</button>
          </h4>
          {rooms.map(r => (
            <div key={r.name} style={{ padding: "5px", borderBottom: "1px solid #ccc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ cursor: "pointer", fontWeight: currentChat?.id === r.name ? "bold" : "normal" }} onClick={() => selectRoomChat(r)}>{r.name}</span>
                {r.creator === user.email && <button onClick={() => deleteRoom(r.name)} style={{ color: "red" }}>Delete</button>}
              </div>
              <div style={{ fontSize: "12px" }}>
                Creator: {r.creator} <br />
                Members: {r.members.join(", ")}
              </div>

              {/* Join request button */}
              {!r.members.includes(user.email) && !hasRequested(r) && (
                <button style={{ marginTop: "5px" }} onClick={() => requestJoin(r)}>Request Join</button>
              )}

              {/* Pending requests for creator */}
              {r.creator === user.email && r.joinRequests.length > 0 && (
  <div style={{ marginTop: "5px" }}>
    Pending Requests:
    {r.joinRequests.map(req => (
      <div key={req} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{req}</span>
        <button onClick={() => approveJoin(r.name, req)}>Approve</button>
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
        <div style={{ padding: "10px", borderBottom: "1px solid #ccc", fontWeight: "bold" }}>
          {currentChat ? currentChat.name : "Select a user or room to chat"}
        </div>
        <div style={{ flex: 1, padding: "10px", overflowY: "auto" }}>
  {messages.map((m, i) => {
    const isMe = m.senderEmail === user.email;
    const justify = isMe ? "flex-end" : "flex-start";

    return (
      <div key={i} style={{ display: "flex", justifyContent: justify, marginBottom: "5px" }}>
        <div style={{
          maxWidth: "70%",
          background: isMe ? "#dcf8c6" : "#f0f0f0",
          padding: "8px",
          borderRadius: "5px"
        }}>
          {/* Only show sender name if room chat and not me */}
          {currentChat?.type === "room" && !isMe && (
            <div style={{ fontWeight: "bold", marginBottom: "3px" }}>{m.senderName}</div>
          )}
          {/* Message content */}
          {m.text && <div>{m.text}</div>}
          {m.file && <a href={`http://localhost:5000${m.file}`} target="_blank" rel="noreferrer">File</a>}
        </div>
      </div>
    );
  })}
  <div ref={messagesEndRef}></div>
</div>

        <div style={{ display: "flex", padding: "10px", borderTop: "1px solid #ccc" }}>
          <input type="text" placeholder="Message" value={text} onChange={e => setText(e.target.value)} style={{ flex: 1, padding: "8px" }} />
          <input type="file" onChange={e => setFile(e.target.files[0])} style={{ marginLeft: "5px" }} />
          <button onClick={sendMessage} style={{ marginLeft: "5px", padding: "8px 12px" }}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
