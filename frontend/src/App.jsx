import React, {useState, useEffect } from 'react';
import ReactGA from "react-ga4";
import Dashboard from './pages/dashboard.jsx';
import CommunityFeed from "./pages/communityFeed";
import Login from "./pages/login";
import './app.css';

ReactGA.initialize('G-4EX09RS1CW');

function App() {
    // used to store the user when logged in
    const [user, setUser] = useState(null);

    // tracks which page is active (dashboard is default)
    const [currentView, setCurrentView] = useState('dashboard');

    // log when user changes views
    useEffect(() => {
        ReactGA.send({
            category: "Page View",
            action: `Switched to ${currentView}`,
            label: `PlantCareAI ${currentView} Screen`
        });
    }, [currentView]);

    useEffect(() => {
        // if the user variable becomes populated, they logged in
        if (user) {
            // tie this GA4 session to their specific UID
            ReactGA.set({ userId: user.uid });

            // log login event
            ReactGA.event({
                category: "Authentication",
                action: "User Logged In",
                label: "PlantCareAI Web Login"
            });
        }
    }, [user]);

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