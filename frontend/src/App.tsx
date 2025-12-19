import { NavLink, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import DiaryPage from "./pages/DiaryPage";
import SocialPage from "./pages/SocialPage";
import HabitsPage from "./pages/HabitsPage";
import GoalsPage from "./pages/GoalsPage";
import SettingsPage from "./pages/SettingsPage";

function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">HG</div>
        <div className="brand-text">
          <div className="brand-title">HabitGraph</div>
          <div className="brand-subtitle">Привычки, дневник, поддержка</div>
        </div>
      </div>

      <nav className="nav">
        <NavLink to="/" end>
          Дашборд
        </NavLink>
        <NavLink to="/habits">Привычки</NavLink>
        <NavLink to="/goals">Цели</NavLink>
        <NavLink to="/diary">Дневник</NavLink>
        <NavLink to="/social">Социальное</NavLink>
      </nav>

      <details className="profile-menu">
        <summary>
          <div className="avatar">П</div>
          <span>Профиль</span>
        </summary>
        <div className="menu">
          <NavLink to="/settings">Настройки</NavLink>
        </div>
      </details>
    </header>
  );
}

export default function App() {
  return (
    <div className="page">
      <div className="bg-gradient" />
      <div className="container">
        <Header />

        <main className="main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/social" element={<SocialPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
