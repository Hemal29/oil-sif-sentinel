"use client";

import { useEffect, useState } from "react";
import { fetchCurrentUser, getStoredUser } from "@/lib/auth";
import type { User } from "@/types/user";

export function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    fetchCurrentUser()
      .then(setUser)
      .catch(() => {
        // Interceptor handles redirect on 401.
      });
  }, []);

  return user;
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "HSE_ADMIN";
}

export function canReview(user: User | null): boolean {
  return user?.role === "HSE_ADMIN" || user?.role === "HSE_REVIEWER";
}
