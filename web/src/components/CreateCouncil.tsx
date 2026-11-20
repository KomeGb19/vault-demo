"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateCouncil({ onDone }: { onDone: () => void }) {
  const [members, setMembers] = useState([
    "Member 1",
    "Member 2",
    "Member 3",
    "Member 4",
    "Member 5",
  ]);
  const [home, setHome] = useState({
    bank: "GTBank",
    number: "0123456789",
    name: "Ada Obi",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("POST", "/vault/create", { members, homeAccount: home });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up VAULT: council + Home Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Council members (5)</Label>
            {members.map((m, i) => (
              <Input
                key={i}
                value={m}
                onChange={(e) =>
                  setMembers(
                    members.map((x, j) => (j === i ? e.target.value : x)),
                  )
                }
              />
            ))}
          </div>
          <div className="space-y-2">
            <Label>Home Account (locked)</Label>
            <Input
              placeholder="Bank"
              value={home.bank}
              onChange={(e) => setHome({ ...home, bank: e.target.value })}
            />
            <Input
              placeholder="Account number"
              value={home.number}
              onChange={(e) => setHome({ ...home, number: e.target.value })}
            />
            <Input
              placeholder="Account name"
              value={home.name}
              onChange={(e) => setHome({ ...home, name: e.target.value })}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 sm:col-span-2">{error}</p>
          )}
          <Button type="submit" disabled={busy} className="sm:col-span-2">
            Create council and lock Home Account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
