import React from "react";
import logo from "./logo.svg";
import "./App.css";
import SyncStreamComponent from "./components/chat-window";

function App() {
  return (
    <div className="App">
      <SyncStreamComponent
        identity="WebApp"
        streamNameOrSid="TO3561c11f7b82f109b1240836d74e94db"
      />
    </div>
  );
}

export default App;
