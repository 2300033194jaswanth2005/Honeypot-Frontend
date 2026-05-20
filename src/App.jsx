import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function App() {
    const [attacks, setAttacks] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [services, setServices] = useState([]);
    const [report, setReport] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [newService, setNewService] = useState({ type: 'ssh', port: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [simulating, setSimulating] = useState(false);
    const pollRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [attacksRes, profilesRes, servicesRes, reportRes] = await Promise.all([
                axios.get(`${API_URL}/attacks`),
                axios.get(`${API_URL}/profiles`),
                axios.get(`${API_URL}/services`),
                axios.get(`${API_URL}/threat-report`)
            ]);
            setAttacks(attacksRes.data || []);
            setProfiles(profilesRes.data || []);
            setServices(servicesRes.data || []);
            setReport(reportRes.data || null);
        } catch (err) {
            setError('Cannot connect to backend. Make sure server is running on port 5000.');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadServices = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/services`);
            setServices(res.data || []);
        } catch (err) {
            console.error('Failed to load services:', err.message);
        }
    }, []);

    useEffect(() => {
        loadData();
        pollRef.current = setInterval(loadData, 5000);
        return () => clearInterval(pollRef.current);
    }, [loadData]);

    const simulateAttack = async () => {
        setSimulating(true);
        try {
            await axios.post(`${API_URL}/simulate-attack`);
            await loadData();
        } catch (err) {
            alert('Simulation failed: ' + err.message);
        } finally {
            setSimulating(false);
        }
    };

    const createService = async () => {
        if (!newService.port) return alert('Please enter a port number');
        try {
            await axios.post(`${API_URL}/services/create`, {
                serviceType: newService.type,
                port: parseInt(newService.port)
            });
            setNewService({ type: 'ssh', port: '' });
            loadServices();
        } catch (err) {
            alert(`Failed to create service: ${err.response?.data?.error || err.message}`);
        }
    };

    const exportData = async (type) => {
        if (type === 'attacks') {
            window.open(`${API_URL}/export/attacks`, '_blank');
        } else {
            try {
                const res = await axios.get(`${API_URL}/export/profiles`);
                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'attacker-profiles.json';
                a.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('Export failed: ' + err.message);
            }
        }
    };

    const getThreatColor = (score) => {
        if (score >= 75) return 'score-3';
        if (score >= 50) return 'score-2';
        if (score >= 25) return 'score-1';
        return 'score-0';
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

    if (loading) return <div className="loading">🛡️ Loading Honeypot Dashboard...</div>;

    return (
        <div className="app">
            <header>
                <h1>🛡️ AI-Enhanced Honeypot System</h1>
                <nav>
                    <button onClick={simulateAttack} disabled={simulating} className="simulate-btn">
                        {simulating ? '⏳ Simulating...' : '⚡ Simulate Attack'}
                    </button>
                    {['dashboard', 'attacks', 'profiles', 'services', 'intel'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={activeTab === tab ? 'active' : ''}
                        >
                            {tab === 'intel' ? 'Threat Intel' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </nav>
            </header>

            {error && <div className="error-banner">⚠️ {error}</div>}

            <main>
                {activeTab === 'dashboard' && (
                    <div className="dashboard">
                        <div className="stats">
                            <div className="stat-card">
                                <h3>Total Attacks</h3>
                                <p className="stat-value">{report?.totalAttacks ?? 0}</p>
                            </div>
                            <div className="stat-card">
                                <h3>Unique Attackers</h3>
                                <p className="stat-value">{report?.uniqueAttackers ?? 0}</p>
                            </div>
                            <div className="stat-card danger">
                                <h3>High Threat</h3>
                                <p className="stat-value">{report?.highThreatAttackers ?? 0}</p>
                            </div>
                            <div className="stat-card">
                                <h3>Active Services</h3>
                                <p className="stat-value">{report?.activeServices ?? 0}</p>
                            </div>
                        </div>

                        {report?.attacksByService?.length > 0 && (
                            <div className="charts">
                                <div className="chart-container">
                                    <h3>Attacks by Service</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={report.attacksByService}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis dataKey="service_type" stroke="#ccc" />
                                            <YAxis stroke="#ccc" />
                                            <Tooltip contentStyle={{ background: '#1a1f3a', border: 'none' }} />
                                            <Legend />
                                            <Bar dataKey="count" fill="#8884d8" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="chart-container">
                                    <h3>Threat Distribution</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={report.attacksByService}
                                                dataKey="count"
                                                nameKey="service_type"
                                                cx="50%" cy="50%"
                                                outerRadius={100}
                                                label={({ service_type, percent }) =>
                                                    `${service_type} ${(percent * 100).toFixed(0)}%`
                                                }
                                            >
                                                {report.attacksByService.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: '#1a1f3a', border: 'none' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div className="live-feed">
                            <h3>🔴 Live Attack Feed</h3>
                            <div className="feed-list">
                                {attacks.length === 0 ? (
                                    <p className="no-data">No attacks yet. Waiting for connections...</p>
                                ) : (
                                    attacks.slice(0, 15).map((attack, i) => (
                                        <div key={i} className="feed-item">
                                            <span className="time">{new Date(attack.timestamp).toLocaleTimeString()}</span>
                                            <span className="ip">{attack.ip}</span>
                                            <span className="service">{attack.service_type || attack.service}</span>
                                            <span className="port">:{attack.port}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'attacks' && (
                    <div className="attacks-view">
                        <div className="section-header">
                            <h2>Attack Logs ({attacks.length})</h2>
                            <button onClick={() => exportData('attacks')} className="export-btn">Export CSV</button>
                        </div>
                        {attacks.length === 0 ? (
                            <p className="no-data">No attacks recorded yet.</p>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>IP Address</th>
                                        <th>Service</th>
                                        <th>Port</th>
                                        <th>Payload</th>
                                        <th>Threat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attacks.map((attack, i) => (
                                        <tr key={i}>
                                            <td>{new Date(attack.timestamp).toLocaleString()}</td>
                                            <td>{attack.ip}</td>
                                            <td>{attack.service_type || attack.service}</td>
                                            <td>{attack.port}</td>
                                            <td className="payload">{(attack.payload || '').substring(0, 60)}</td>
                                            <td><span className={`badge ${attack.threat_level || 'medium'}`}>{attack.threat_level || 'medium'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'profiles' && (
                    <div className="profiles-view">
                        <div className="section-header">
                            <h2>Attacker Profiles ({profiles.length})</h2>
                            <button onClick={() => exportData('profiles')} className="export-btn">Export JSON</button>
                        </div>
                        {profiles.length === 0 ? (
                            <p className="no-data">No attacker profiles yet.</p>
                        ) : (
                            <div className="profiles-grid">
                                {profiles.map((profile, i) => (
                                    <div key={i} className="profile-card">
                                        <div className="profile-header">
                                            <h3>{profile.ip}</h3>
                                            <span className={`threat-score ${getThreatColor(profile.threat_score)}`}>
                                                {profile.threat_score}/100
                                            </span>
                                        </div>
                                        <div className="profile-details">
                                            <p><strong>Attacks:</strong> {profile.attack_count}</p>
                                            <p><strong>First Seen:</strong> {new Date(profile.first_seen).toLocaleString()}</p>
                                            <p><strong>Last Seen:</strong> {new Date(profile.last_seen).toLocaleString()}</p>
                                            <div className="tags">
                                                <strong>Tools: </strong>
                                                {profile.tools_detected?.length > 0
                                                    ? profile.tools_detected.map((tool, j) => (
                                                        <span key={j} className="tag tool">{tool}</span>
                                                    ))
                                                    : <span className="tag-none">None detected</span>
                                                }
                                            </div>
                                            <div className="tags">
                                                <strong>TTPs: </strong>
                                                {profile.ttps?.length > 0
                                                    ? profile.ttps.map((ttp, j) => (
                                                        <span key={j} className="tag ttp">{ttp}</span>
                                                    ))
                                                    : <span className="tag-none">None detected</span>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'services' && (
                    <div className="services-view">
                        <h2>Dynamic Honeypot Services</h2>

                        <div className="create-service">
                            <h3>Spawn New Honeypot Service</h3>
                            <div className="form-group">
                                <select
                                    value={newService.type}
                                    onChange={(e) => setNewService({ ...newService, type: e.target.value })}
                                >
                                    {['ssh', 'mysql', 'ftp', 'http', 'telnet', 'smtp'].map(s => (
                                        <option key={s} value={s}>{s.toUpperCase()}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    placeholder="Port (e.g. 8080)"
                                    value={newService.port}
                                    min="1024"
                                    max="65535"
                                    onChange={(e) => setNewService({ ...newService, port: e.target.value })}
                                />
                                <button onClick={createService}>Create Service</button>
                            </div>
                        </div>

                        <div className="services-list">
                            <h3>Active Services ({services.length})</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Service</th>
                                        <th>Port</th>
                                        <th>Protocol</th>
                                        <th>Created</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {services.map((service, i) => (
                                        <tr key={i}>
                                            <td>{service.service_name?.toUpperCase()}</td>
                                            <td>{service.port}</td>
                                            <td>{service.protocol?.toUpperCase()}</td>
                                            <td>{new Date(service.created_at).toLocaleString()}</td>
                                            <td><span className="badge active">Active</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'intel' && (
                    <div className="intel-view">
                        <h2>Threat Intelligence Report</h2>
                        <div className="intel-report">
                            <div className="report-section">
                                <h3>Executive Summary</h3>
                                <p>Total attack attempts: <strong>{report?.totalAttacks ?? 0}</strong></p>
                                <p>Unique threat actors: <strong>{report?.uniqueAttackers ?? 0}</strong></p>
                                <p>High-risk attackers (score ≥ 70): <strong>{report?.highThreatAttackers ?? 0}</strong></p>
                                <p>Active honeypot services: <strong>{report?.activeServices ?? 0}</strong></p>
                                <p>Report generated: {new Date().toLocaleString()}</p>
                            </div>

                            <div className="report-section">
                                <h3>Attack Vector Analysis</h3>
                                {report?.attacksByService?.length > 0 ? (
                                    <ul>
                                        {report.attacksByService.map((item, i) => (
                                            <li key={i}>
                                                <strong>{item.service_type?.toUpperCase()}:</strong> {item.count} attempts
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className="no-data">No attack data yet.</p>}
                            </div>

                            <div className="report-section">
                                <h3>Top Threat Actors</h3>
                                {profiles.length === 0 ? (
                                    <p className="no-data">No threat actors identified yet.</p>
                                ) : (
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>IP Address</th>
                                                <th>Threat Score</th>
                                                <th>Attacks</th>
                                                <th>Tools Detected</th>
                                                <th>TTPs</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {profiles.slice(0, 10).map((p, i) => (
                                                <tr key={i}>
                                                    <td>{p.ip}</td>
                                                    <td>
                                                        <span className={`threat-score ${getThreatColor(p.threat_score)}`}>
                                                            {p.threat_score}
                                                        </span>
                                                    </td>
                                                    <td>{p.attack_count}</td>
                                                    <td>{p.tools_detected?.join(', ') || 'Unknown'}</td>
                                                    <td>{p.ttps?.join(', ') || 'Unknown'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
