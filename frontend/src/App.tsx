import { Link, Route, Routes, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import DiaryPage from "./pages/DiaryPage";
import SocialPage from "./pages/SocialPage";
import { useUser } from "./context/UserContext";

function Header() {
  const { pathname } = useLocation();
  const { userId, setUserId } = useUser();

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">HG</div>
        <div className="brand-text">
          <div className="brand-title">HabitGraph</div>
          <div className="brand-subtitle">Привычки, дневник, рекомендации</div>
        </div>
      </div>
      <nav className="nav">
        <Link className={pathname === "/" ? "active" : ""} to="/">
          Дашборд
        </Link>
        <Link className={pathname === "/diary" ? "active" : ""} to="/diary">
          Дневник
        </Link>
        <Link className={pathname === "/social" ? "active" : ""} to="/social">
          Соцграф
        </Link>
      </nav>
      <div className="userbox">
        <label className="muted tiny" htmlFor="user-id">
          user_id
        </label>
        <div className="row">
          <input
            id="user-id"
            value={userId}
            onChange={(e) => setUserId(Number(e.target.value))}
            className="user-input"
          />
          <span className="chip">X-User-Id</span>
        </div>
        <div className="muted tiny">Сохраняется в браузере</div>
      </div>
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
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/social" element={<SocialPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
