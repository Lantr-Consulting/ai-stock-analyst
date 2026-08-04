"use client";

import { useLanguage } from "@/lib/language";
import { TopBar as EnglishTopBar } from "./topbar.en";
import { TopBar as ChineseTopBar } from "./topbar.zh";

export function TopBar() {
  return useLanguage() === "en" ? <EnglishTopBar /> : <ChineseTopBar />;
}
