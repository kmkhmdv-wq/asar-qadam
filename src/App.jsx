import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import { AuthView } from './views/AuthView';
import { ProfileView } from './views/ProfileView';
import { DashboardView } from './views/DashboardView';
import { ScheduleView } from './views/ScheduleView';
import { ChildrenView } from './views/ChildrenView';
import { SpecialistsView } from './views/SpecialistsView';
import { AttendanceView } from './views/AttendanceView';
import { AccountingView } from './views/AccountingView';
import { PayrollView } from './views/PayrollView';
import { AiAccountantView } from './views/AiAccountantView';
import { UsersAndRequestsView } from './views/UsersAndRequestsView';
import { AuditLogView } from './views/AuditLogView';
import { GeminiAssistantWidget } from './components/GeminiAssistantWidget';

export const App = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  React.useEffect(() => {
    if (user?.role === 'specialist') {
      const restricted = ['accounting', 'payroll', 'ai', 'users', 'audit'];
      if (restricted.includes(currentView)) {
        setCurrentView('dashboard');
      }
    } else if (user?.role === 'admin') {
      const restricted = ['payroll', 'users', 'audit'];
      if (restricted.includes(currentView)) {
        setCurrentView('dashboard');
      }
    }
  }, [user, currentView]);

  const viewTitles = {
    dashboard: { title: 'Главная панель управления', subtitle: 'Оперативная сводка деятельности центра Asar Qadam' },
    schedule: { title: 'Умное интерактивное расписание', subtitle: 'Сетка слотов по специалистам, защита от двойной записи и Drag & Drop' },
    children: { title: 'Карточки детей и медицинский контроль', subtitle: 'База воспитанников с контролем аллергий, астмы и эпилепсии' },
    specialists: { title: 'Специалисты центра', subtitle: 'Штатные сотрудники, направления работы, тарифы и ставки' },
    attendance: { title: 'Учёт посещаемости', subtitle: 'Электронный табель сессий с авто-синхронизацией в бухгалтерию' },
    accounting: { title: 'Интеллектуальная бухгалтерия', subtitle: 'Автоматический расчёт доходов 50/50, дебиторская задолженность и кассовый журнал' },
    payroll: { title: 'Заработная плата специалистов', subtitle: 'Раздельный учёт начислений и выплат, ведомость задолженностей' },
    ai: { title: 'AI-Бухгалтер Asar Qadam', subtitle: 'Интеллектуальный помощник для анализа финансовых показателей и отчётов' },
    users: { title: 'Заявки на регистрацию и права доступа', subtitle: 'Ролевая модель доступа (RBAC) и одобрение новых пользователей' },
    audit: { title: 'Журнал аудита системы', subtitle: 'Неизменяемый протокол всех действий сотрудников и операций' },
    profile: { title: 'Личный кабинет сотрудника', subtitle: 'Редактирование личных данных, контактов и параметров безопасности' }
  };

  const currentInfo = viewTitles[currentView] || viewTitles.dashboard;

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        color: 'var(--color-teal-dark)',
        fontWeight: '800',
        fontSize: '18px',
        letterSpacing: '0.04em'
      }}>
        ЗАГРУЗКА ПЛАТФОРМЫ ASAR QADAM CRM...
      </div>
    );
  }

  // 1. Mandatory Authentication Gate: No inner CRM data shown before login
  if (!user) {
    return <AuthView />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Permanent Sidebar on Desktop, Drawer on Mobile */}
      <Navigation 
        currentView={currentView} 
        onViewChange={(view) => {
          setCurrentView(view);
          setIsMobileNavOpen(false);
        }} 
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        <Header 
          title={currentInfo.title}
          subtitle={currentInfo.subtitle}
          onQuickAction={currentView === 'dashboard' ? () => setCurrentView('schedule') : null}
          quickActionLabel={currentView === 'dashboard' ? 'Расписание' : null}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          onNavigateToProfile={() => setCurrentView('profile')}
        />

        <main style={{ flex: 1 }}>
          {currentView === 'dashboard' && <DashboardView onNavigate={setCurrentView} />}
          {currentView === 'schedule' && <ScheduleView />}
          {currentView === 'children' && <ChildrenView />}
          {currentView === 'specialists' && <SpecialistsView />}
          {currentView === 'attendance' && <AttendanceView />}
          {currentView === 'accounting' && <AccountingView />}
          {currentView === 'payroll' && <PayrollView />}
          {currentView === 'ai' && <AiAccountantView />}
          {currentView === 'users' && <UsersAndRequestsView />}
          {currentView === 'audit' && <AuditLogView />}
          {currentView === 'profile' && <ProfileView />}
        </main>
      </div>

      {/* Floating Google Gemini AI Assistant */}
      <GeminiAssistantWidget currentView={currentView} />
    </div>
  );
};

