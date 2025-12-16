import { Link, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import DiaryPage from "./pages/DiaryPage";
import SocialPage from "./pages/SocialPage";

export default function App() {
  return (
    <div className="container">
      <header className="header">
        <div className="brand">HabitGraph</div>
        <nav className="nav">
          <Link to="/">Dashboard</Link>
          <Link to="/diary">Diary</Link>
          <Link to="/social">Social</Link>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/social" element={<SocialPage />} />
        </Routes>
      </main>
    </div>
  );
}

