import { useEffect, useState } from "react";
import { api } from "./api";
import { AuthScreen } from "./components/AuthScreen";
import { WorkspaceShell } from "./components/WorkspaceShell";
import type { Bootstrap, Page, User, Workspace } from "./types";

type ReadyState = { user: User; workspace: Workspace; pages: Page[] };

export function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.bootstrap()
      .then((result) => {
        setBootstrap(result);
        if (result.user && result.workspace) setReady({ user: result.user, workspace: result.workspace, pages: result.pages ?? [] });
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  if (error) return <FatalError message={error} />;
  if (!bootstrap) return <div className="loading-screen"><span className="mark">C</span></div>;
  if (!ready) {
    return (
      <AuthScreen
        mode={bootstrap.needsSetup ? "setup" : "login"}
        onReady={(next) => {
          setReady(next);
          setBootstrap({ needsSetup: false, requiresAuth: false });
        }}
      />
    );
  }

  return (
    <WorkspaceShell
      {...ready}
      onPagesChange={(pages) => setReady((current) => current ? { ...current, pages } : current)}
      onLogout={async () => {
        await api.logout();
        setReady(null);
        setBootstrap({ needsSetup: false, requiresAuth: true });
      }}
    />
  );
}

function FatalError({ message }: { message: string }) {
  return <main className="fatal"><h1>Couldn’t open Conf Simple</h1><p>{message}</p><button onClick={() => location.reload()}>Try again</button></main>;
}
