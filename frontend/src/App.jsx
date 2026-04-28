import React from 'react';
import Dashboard from './pages/dashboard.jsx';
import Login from "./pages/login";

function App() {
    // used to store the user when logged in
    const [user, setUser] = React.useState(null);

    return (
        <div className="App">
            {/* basic routing to show dashboard if not logged in */}
            {user ? (<Dashboard user={user}/>) : (<Login setUser={setUser} />)}
        </div>
    );
}

export default App;