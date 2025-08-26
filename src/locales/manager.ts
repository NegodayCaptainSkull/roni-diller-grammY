import { getUser } from "../globals.js";
// import { UserLanguage } from "../types.js";
import ru from "./ru.js";
import en from "./en.js";

export const getCurrentTranslations = (userId: string | number) => {
  const lang = getUser(userId).language || "ru";
  return lang === "ru" ? ru : en;
};

// export const getTranslations = (lang: UserLanguage) => {
//   return lang === "ru" ? ru : en;
// };