"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken, type User } from "@/lib/api";
import AuthForm from "@/components/AuthForm";
import CreateCouncil from "@/components/CreateCouncil";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasCouncil, setHasCouncil] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const me = await api<{ user: User }>("GET", "/auth/me");
      setUser(me.user);
      try {
        await api("GET", "/vault/council/mine");
        setHasCouncil(true);
      } catch {
        setHasCouncil(false);
      }
    } catch {
      setToken(null);
      setUser(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!ready) return <p className="p-6">Loading...</p>;

  return (
    <main className="mx-auto mt-10 flex flex-col items-center justify-center max-w-4xl space-y-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">
        VAULT{" "}
        <span className="text-base font-normal text-muted-foreground">
          DemoBank
        </span>
      </h1>
      {!user ? (
        <AuthForm onDone={load} />
      ) : !hasCouncil ? (
        <CreateCouncil onDone={load} />
      ) : (
        <Dashboard
          onReset={load}
          onLogout={() => {
            setToken(null);
            setUser(null);
            setHasCouncil(false);
          }}
        />
      )}
    </main>
  );
}
