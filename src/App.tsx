import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { appStore } from './app/deps';
import { useAppStore } from './app/useAppStore';
import { AppLayout } from './components/AppLayout';
import { LibraryPage } from './pages/LibraryPage';
import { NewQuestionPage } from './pages/NewQuestionPage';
import { PracticePage } from './pages/PracticePage';
import { SummaryPage } from './pages/SummaryPage';
import styles from './App.module.css';

let booted = false;

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const bootError = useAppStore((s) => s.bootError);

  // StrictMode 下 effect 会跑两次，用模块级标记避免重复恢复队列
  useEffect(() => {
    if (booted) return;
    booted = true;
    void appStore.getState().init();
  }, []);

  if (!ready) {
    return <div className={styles.boot}>正在打开本地题库…</div>;
  }
  if (bootError) {
    return (
      <div className={styles.boot}>
        <p>本地数据库打不开</p>
        <p className={styles.detail}>{bootError}</p>
      </div>
    );
  }

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/new" element={<NewQuestionPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
