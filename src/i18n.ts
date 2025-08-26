import { NextFunction } from 'grammy';
import { refs } from './globals.js';
import { MyContext, ITranslations } from './types.js';
import ru from './locales/ru.js';
import en from './locales/en.js';

const translations = {
  ru: ru as ITranslations,
  en: en as ITranslations
};

export function useI18n() {
  return async (ctx: MyContext, next: NextFunction) => {
    try {
      const userId = String(ctx.from?.id);
      if (!userId) {
        return await next();
      }

      // Получаем данные пользователя из нового пути refs.users
      const userSnapshot = await refs.users.child(userId).once('value');
      const userData = userSnapshot.val();
      
      // Язык из данных пользователя или 'ru' по умолчанию
      const lang = userData?.language || 'ru';
      
      // Добавляем функцию перевода в контекст
      ctx.t = (key: keyof ITranslations, params?: Record<string, string | number>): string => {
        let text = translations[lang as 'ru'|'en'][key];
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          }
        }
        return text;
      };

      await next();
    } catch (error) {
      console.error('i18n middleware error:', error);
      // В продакшене можно добавить отправку ошибки админу
      throw error;
    }
  };
}