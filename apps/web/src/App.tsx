import { HashRouter, MemoryRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { StoreProvider } from './state/store';
import { AuthProvider } from './state/cloud';
import { NewPasswordModal, RequireAuth } from './pages/publico/Auth';
import { DemoBar } from './components/DemoBar';
import { AlunoLayout, PersonalLayout, Toasts } from './components/Layouts';
import Landing from './pages/publico/Landing';
import { Login, NotFound, Privacy, Terms } from './pages/publico/Pages';
import Dashboard from './pages/personal/Dashboard';
import Students, { NewStudent } from './pages/personal/Students';
import StudentDetail from './pages/personal/StudentDetail';
import Builder from './pages/personal/Builder';
import Assessments from './pages/personal/Assessments';
import Cycles, { Notifications } from './pages/personal/Cycles';
import Agents, { AgentEditor } from './pages/personal/Agents';
import Library, { SubscriptionPage } from './pages/personal/Library';
import { AlunoAssessment, AlunoHistory, AlunoHome, AlunoProfile, Session } from './pages/aluno/Aluno';
import Admin from './pages/admin/Admin';
import { DemoGallery } from './pages/dev/DemoGallery';

function Shell() {
  const { pathname } = useLocation();
  // Navegadores novos fazem scrollTo devolver uma Promise; o efeito não pode retorná-la (React trataria como limpeza).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <DemoBar />
      <Outlet />
      <NewPasswordModal />
      <Toasts />
    </>
  );
}

// No artifact compartilhável a URL não muda; fora dele, o hash permite voltar e favoritar.
const Router = import.meta.env.MODE === 'artifact' ? MemoryRouter : HashRouter;

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <Router>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Landing />} />
              <Route path="entrar" element={<Login />} />
              <Route path="termos" element={<Terms />} />
              <Route path="privacidade" element={<Privacy />} />
              <Route element={<RequireAuth />}>
                <Route path="personal" element={<PersonalLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="alunos" element={<Students />} />
                  <Route path="alunos/novo" element={<NewStudent />} />
                  <Route path="alunos/:id" element={<StudentDetail />} />
                  <Route path="alunos/:id/editar-treino" element={<Builder />} />
                  <Route path="avaliacoes" element={<Assessments />} />
                  <Route path="ciclos" element={<Cycles />} />
                  <Route path="agentes" element={<Agents />} />
                  <Route path="agentes/:id" element={<AgentEditor />} />
                  <Route path="exercicios" element={<Library />} />
                  <Route path="assinatura" element={<SubscriptionPage />} />
                  <Route path="notificacoes" element={<Notifications />} />
                </Route>
                <Route path="aluno" element={<AlunoLayout />}>
                  <Route index element={<AlunoHome />} />
                  <Route path="sessao/:logId" element={<Session />} />
                  <Route path="historico" element={<AlunoHistory />} />
                  <Route path="avaliacao" element={<AlunoAssessment />} />
                  <Route path="perfil" element={<AlunoProfile />} />
                </Route>
                <Route path="admin" element={<Admin />} />
              </Route>
              {import.meta.env.DEV && <Route path="dev/demos" element={<DemoGallery />} />}
              <Route path="inicio" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </StoreProvider>
    </AuthProvider>
  );
}
