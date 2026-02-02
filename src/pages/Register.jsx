// src/Register.jsx
import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

// This checks for the Environment Variable, or defaults to localhost
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [msg, setMsg] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
      if (avatar) formData.append("avatar", avatar);

      // Logic unchanged: now using the dynamic BACKEND_URL variable
      await axios.post(`${BACKEND_URL}/register`, formData);
      navigate("/login");
    } catch (err) {
      setMsg(err.response?.data?.msg || "Register failed");
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f0f2f5" }}>
      <form onSubmit={handleRegister} style={{ padding: "30px", background: "#fff", borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", width: "300px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Register</h2>
        {msg && <p style={{ color: "red" }}>{msg}</p>}
        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "4px", border: "1px solid #ccc" }} />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "4px", border: "1px solid #ccc" }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "4px", border: "1px solid #ccc" }} />
        <input type="file" onChange={e => setAvatar(e.target.files[0])} style={{ marginBottom: "15px" }} />
        <button type="submit" style={{ width: "100%", padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px" }}>Register</button>
        <p style={{ marginTop: "10px", textAlign: "center" }}>
          Already have account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;