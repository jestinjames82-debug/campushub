"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "./supabase/client";
import type { Profile, Subject, Term } from "./models";
import { loadAllRows } from "./pagination";
export type FeatureProps = {
  demo: boolean;
  userId: string;
  profile: Profile | null;
  subjects: Subject[];
  terms: Term[];
};
export const recordKinds = [
  "task",
  "class",
  "attendance",
  "assessment",
  "grade_scale",
  "goal",
  "note",
  "resource",
  "revision",
  "application",
  "portfolio",
  "career_task",
  "preferences",
] as const;
export function cleanupDemoSubjects(ids: string[]) {
  for (const kind of recordKinds) {
    const key = `campushub-demo-records-${kind}-v1`;
    const saved = localStorage.getItem(key);
    if (!saved) continue;
    const items = JSON.parse(saved) as Array<Record<string, unknown>>;
    const cleaned = items.flatMap((item) => {
      if (!ids.includes(String(item.subject_id || ""))) return [item];
      return ["class", "attendance", "assessment"].includes(kind)
        ? []
        : [{ ...item, subject_id: "" }];
    });
    localStorage.setItem(key, JSON.stringify(cleaned));
  }
}
export function useRecords<T extends object>(
  kind: string,
  demo: boolean,
  userId: string,
  seed: T[] = [],
) {
  const [items, setItems] = useState<Array<T & { id: string }>>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const initial = useRef(seed),
    current = useRef<Array<T & { id: string }>>([]),
    mounted = useRef(true);
  const key = `campushub-${demo ? "demo" : userId}-records-${kind}-v1`;
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let next: Array<T & { id: string }>;
      if (demo) {
        const saved = localStorage.getItem(key);
        next = saved
          ? JSON.parse(saved)
          : initial.current.map((data) => ({
              ...data,
              id: crypto.randomUUID(),
            }));
        if (!Array.isArray(next))
          throw new Error("This saved demo data could not be read.");
        if (!saved) localStorage.setItem(key, JSON.stringify(next));
      } else {
        const data = await loadAllRows<{
          id: string;
          data: Record<string, unknown>;
          created_at: string;
        }>(async (cursor) => {
          let query = browserClient()
            .from("workspace_records")
            .select("id,data,created_at")
            .eq("kind", kind)
            .order("id")
            .limit(500);
          if (cursor) query = query.gt("id", cursor);
          const { data, error } = await query;
          if (error) throw new Error(error.message);
          return data || [];
        });
        next = data
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((row) => ({ ...row.data, id: row.id }) as T & { id: string });
      }
      if (mounted.current) {
        current.current = next;
        setItems(next);
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Could not load these records.",
        );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [demo, key, kind]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  const save = useCallback(
    async (data: T, id?: string) => {
      setError("");
      try {
        if (!recordKinds.includes(kind as (typeof recordKinds)[number]))
          throw new Error("Unsupported record type.");
        const clean = { ...data } as Record<string, unknown>;
        delete clean.id;
        const rowId = id || crypto.randomUUID();
        if (!demo) {
          const row = { id: rowId, user_id: userId, kind, data: clean };
          const result = id
            ? await browserClient()
                .from("workspace_records")
                .update({ data: clean })
                .eq("id", id)
                .eq("kind", kind)
                .select("id")
                .single()
            : await browserClient()
                .from("workspace_records")
                .insert(row)
                .select("id")
                .single();
          if (result.error) throw new Error(result.error.message);
        }
        const next = [
          { ...clean, id: rowId } as T & { id: string },
          ...current.current.filter((row) => row.id !== rowId),
        ];
        if (demo) localStorage.setItem(key, JSON.stringify(next));
        current.current = next;
        if (mounted.current) setItems(next);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not save.";
        setError(message);
        throw new Error(message);
      }
    },
    [demo, key, kind, userId],
  );
  const remove = useCallback(
    async (id: string) => {
      setError("");
      try {
        if (!demo) {
          const { error } = await browserClient()
            .from("workspace_records")
            .delete()
            .eq("id", id)
            .eq("kind", kind)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
        }
        const next = current.current.filter((row) => row.id !== id);
        if (demo) localStorage.setItem(key, JSON.stringify(next));
        current.current = next;
        if (mounted.current) setItems(next);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not delete.";
        setError(message);
        throw new Error(message);
      }
    },
    [demo, key, kind],
  );
  return { items, loading, error, save, remove, refresh };
}
