import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Extract from "./pages/Extract";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/extract" element={<Extract />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
