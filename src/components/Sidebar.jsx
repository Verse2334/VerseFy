import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { IoHomeSharp, IoLibrary, IoCloudUpload, IoMusicalNotes, IoSearch, IoVolumeHigh, IoHeart, IoServer, IoSettings, IoStatsChart, IoInformationCircle, IoChevronBack, IoChevronForward, IoMic } from 'react-icons/io5';
import './Sidebar.css';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('versefy-sidebar-collapsed') === 'true');

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('versefy-sidebar-collapsed', String(next));
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <IoMusicalNotes className="logo-icon" />
        {!collapsed && <span className="logo-text">Versefy</span>}
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end title="Home">
          <IoHomeSharp /> {!collapsed && <span>Home</span>}
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Search">
          <IoSearch /> {!collapsed && <span>Search</span>}
        </NavLink>
        <NavLink to="/library" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Library">
          <IoLibrary /> {!collapsed && <span>Library</span>}
        </NavLink>
        <NavLink to="/favorites" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Favorites">
          <IoHeart /> {!collapsed && <span>Favorites</span>}
        </NavLink>
        <NavLink to="/upload" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Upload">
          <IoCloudUpload /> {!collapsed && <span>Upload</span>}
        </NavLink>

        <div className="sidebar-divider" />

        <NavLink to="/playlists" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Playlists">
          <IoMusicalNotes /> {!collapsed && <span>Playlists</span>}
        </NavLink>
        <NavLink to="/sfx" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="SFX Manager">
          <IoVolumeHigh /> {!collapsed && <span>SFX Manager</span>}
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Stats">
          <IoStatsChart /> {!collapsed && <span>Stats</span>}
        </NavLink>
        <NavLink to="/recorder" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Recorder">
          <IoMic /> {!collapsed && <span>Recorder</span>}
        </NavLink>
        <NavLink to="/storage" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Storage">
          <IoServer /> {!collapsed && <span>Storage</span>}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Settings">
          <IoSettings /> {!collapsed && <span>Settings</span>}
        </NavLink>
        <NavLink to="/info" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Info">
          <IoInformationCircle /> {!collapsed && <span>Info</span>}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-collapse-btn" onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <IoChevronForward /> : <IoChevronBack />}
        </button>
      </div>
    </aside>
  );
}
