import { NavLink, Outlet } from 'react-router-dom';
import styles from './AppLayout.module.css';

const navClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? `${styles.link} ${styles.active}` : styles.link;

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <span>错笺</span>
          <span className={styles.brandEn}>CuoJian</span>
        </NavLink>
        <nav className={styles.nav}>
          <NavLink to="/" end className={navClass}>
            题库
          </NavLink>
          <NavLink to="/new" className={navClass}>
            录入
          </NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>数据只在本机 · 无账号 · 不联网 · 可导出</footer>
    </div>
  );
}
