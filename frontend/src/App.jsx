import React from 'react';
import Dashboard from './pages/dashboard.jsx';
import CommunityFeed from "./pages/communityFeed";
import Login from "./pages/login";
import './app.css';

function App() {
    // used to store the user when logged in
    const [user, setUser] = React.useState(null);

    // tracks which page is active (dashboard is default)
    const [currentView, setCurrentView] = React.useState('dashboard');

    return (
        <div className="appContainer">
            {/* basic routing to show main app if logged in, else login screen */}
            {user ? (
                <div>
                    {/* switch between dashboard and community feed*/}
                    <nav className="mainNav">
                        <button
                            onClick={() => setCurrentView('dashboard')}
                            className={`navButton ${currentView === 'dashboard' ? 'active' : ''}`}
                        >
                            My Dashboard
                        </button>

                        <button
                            onClick={() => setCurrentView('community')}
                            className={`navButton ${currentView === 'community' ? 'active' : ''}`}
                        >
                            Community Feed
                        </button>
                    </nav>

                    {/* choose which one to render */}
                    {currentView === 'dashboard' ? (
                        <Dashboard user={user} />
                    ) : (
                        <CommunityFeed />
                    )}
                </div>
            ) : (
                <Login setUser={setUser} />
            )}
        </div>
    );
}

export default App;