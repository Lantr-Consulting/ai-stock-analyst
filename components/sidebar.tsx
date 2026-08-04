"use client";

import { useLanguage } from "@/lib/language";
import { Sidebar as EnglishSidebar, MobileNav as EnglishMobileNav } from "./sidebar.en";
import { Sidebar as ChineseSidebar, MobileNav as ChineseMobileNav } from "./sidebar.zh";

export function Sidebar() {
  return useLanguage() === "en" ? <EnglishSidebar /> : <ChineseSidebar />;
}

export function MobileNav() {
  return useLanguage() === "en" ? <EnglishMobileNav /> : <ChineseMobileNav />;
}
