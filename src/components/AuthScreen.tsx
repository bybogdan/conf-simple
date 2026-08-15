import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { api } from "../api";
import type { Page, User, Workspace } from "../types";
import { BrandLockup } from "./BrandMark";

type Props = {
  mode: "setup" | "login";
  onReady: (state: { user: User; workspace: Workspace; pages: Page[] }) => void;
};

export function AuthScreen({ mode, onReady }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = mode === "setup"
        ? await api.setup({
            workspaceName: String(data.get("workspaceName")),
            displayName: String(data.get("displayName")),
            email: String(data.get("email")),
            password: String(data.get("password")),
          })
        : await api.login({ email: String(data.get("email")), password: String(data.get("password")) });
      onReady({ user: result.user, workspace: result.workspace, pages: result.pages });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      setPending(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-form-wrap">
        <BrandLockup />
        <div className="auth-heading">
          <p className="eyebrow">{mode === "setup" ? "First-run setup" : "Welcome back"}</p>
          <h1>{mode === "setup" ? "Create your workspace" : "Sign in to your workspace"}</h1>
          <p>{mode === "setup" ? "Set up the first admin account. You can start writing as soon as this is done." : "Use your local account to continue."}</p>
        </div>
        <form onSubmit={submit}>
          {mode === "setup" && <Field label="Workspace name" name="workspaceName" placeholder="Acme Engineering" autoFocus />}
          {mode === "setup" && <Field label="Your name" name="displayName" placeholder="Jane Chen" />}
          <Field label="Email" name="email" type="email" placeholder="jane@company.com" autoFocus={mode === "login"} />
          <Field label="Password" name="password" type="password" placeholder={mode === "setup" ? "At least 10 characters" : "Your password"} minLength={mode === "setup" ? 10 : undefined} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary auth-submit" disabled={pending}>
            {pending ? "Please wait…" : mode === "setup" ? "Create workspace" : "Sign in"}<ArrowRight size={15} />
          </button>
        </form>
        <p className="auth-footnote">Your data stays on this installation.</p>
      </section>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return <label className="field"><span>{label}</span><input required {...inputProps} /></label>;
}
