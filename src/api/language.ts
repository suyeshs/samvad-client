import { D1Database, KVNamespace } from '@cloudflare/workers-types';

interface LanguageConfig {
  code: string;
  name: string;
  greeting: string;
  greetingAudio?: string;
  flag?: string;
  agentName: string;
  agentDescription?: string;
}

interface CFData {
  country: string;
  city?: string;
  timezone?: string;
  ip?: string;
  locale?: string;
}

interface LanguageDetectionRequest {
  cfData: CFData;
  browserLocale?: string;
  userId?: string;
}

interface LanguageDetectionResponse {
  language: LanguageConfig;
  confidence: number;
  reason: string;
}

interface UpdateUserLanguageRequest {
  userId: string;
  languageCode: string;
}

export class LanguageService {
  constructor(
    private db: D1Database,
    private kv: KVNamespace
  ) {}

  // Get language from cache or database
  async getLanguage(code: string): Promise<LanguageConfig | null> {
    // Try cache first
    const cached = await this.kv.get(`lang:${code}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const result = await this.db.prepare(`
      SELECT code, name, greeting, greeting_audio_url, flag, agent_name, agent_description 
      FROM languages 
      WHERE code = ? AND is_active = 1
    `).bind(code).first();

    if (result) {
      const language: LanguageConfig = {
        code: result.code as string,
        name: result.name as string,
        greeting: result.greeting as string,
        flag: result.flag as string,
        greetingAudio: result.greeting_audio_url as string || undefined,
        agentName: result.agent_name as string,
        agentDescription: result.agent_description as string || undefined
      };

      // Cache for 1 hour
      await this.kv.put(`lang:${code}`, JSON.stringify(language), { expirationTtl: 3600 });
      return language;
    }

    return null;
  }

  // Get all active languages
  async getAllLanguages(): Promise<LanguageConfig[]> {
    // Try cache first
    const cached = await this.kv.get('langs:all');
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const result = await this.db.prepare(`
      SELECT code, name, greeting, greeting_audio_url, flag, agent_name, agent_description 
      FROM languages 
      WHERE is_active = 1 
      ORDER BY code
    `).all();

    const languages: LanguageConfig[] = result.results.map((row: Record<string, unknown>) => ({
      code: row.code as string,
      name: row.name as string,
      greeting: row.greeting as string,
      flag: row.flag as string,
      greetingAudio: row.greeting_audio_url as string || undefined,
      agentName: row.agent_name as string,
      agentDescription: row.agent_description as string || undefined
    }));

    // Cache for 1 hour
    await this.kv.put('langs:all', JSON.stringify(languages), { expirationTtl: 3600 });
    return languages;
  }

  // Detect language based on CF data and browser locale
  async detectLanguage(request: LanguageDetectionRequest): Promise<LanguageDetectionResponse> {
    const { cfData, browserLocale, userId } = request;

    // Try to get user's previous preference
    if (userId) {
      const userPref = await this.getUserLanguagePreference(userId);
      if (userPref) {
        const language = await this.getLanguage(userPref.language_code);
        if (language) {
          return {
            language,
            confidence: 0.9,
            reason: 'User preference'
          };
        }
      }
    }

    // Try CF locale first
    if (cfData.locale) {
      const cfLanguageCode = cfData.locale.split('-')[0];
      const language = await this.getLanguage(cfLanguageCode);
      if (language) {
        await this.saveUserLanguagePreference(userId, cfLanguageCode, cfData, browserLocale);
        return {
          language,
          confidence: 0.8,
          reason: 'CF locale'
        };
      }
    }

    // Try browser locale
    if (browserLocale) {
      const browserLanguageCode = browserLocale.split('-')[0];
      const language = await this.getLanguage(browserLanguageCode);
      if (language) {
        await this.saveUserLanguagePreference(userId, browserLanguageCode, cfData, browserLocale);
        return {
          language,
          confidence: 0.7,
          reason: 'Browser locale'
        };
      }
    }

    // Try country-based detection
    if (cfData.country) {
      const countryLanguage = await this.getCountryDefaultLanguage(cfData.country);
      if (countryLanguage) {
        await this.saveUserLanguagePreference(userId, countryLanguage.code, cfData, browserLocale);
        return {
          language: countryLanguage,
          confidence: 0.6,
          reason: 'Country default'
        };
      }
    }

    // Fallback to English
    const defaultLanguage = await this.getLanguage('en');
    if (defaultLanguage) {
      await this.saveUserLanguagePreference(userId, 'en', cfData, browserLocale);
      return {
        language: defaultLanguage,
        confidence: 0.5,
        reason: 'Default'
      };
    }

    // Last resort
    return {
      language: {
        code: 'en',
        name: 'English',
        greeting: 'How May I Help You',
        flag: '🇺🇸',
        agentName: 'Alex',
        agentDescription: 'Your English-speaking AI assistant'
      },
      confidence: 0.1,
      reason: 'Fallback'
    };
  }

  // Get country's default language
  private async getCountryDefaultLanguage(countryCode: string): Promise<LanguageConfig | null> {
    const result = await this.db.prepare(`
      SELECT l.code, l.name, l.greeting, l.greeting_audio_url, l.flag, l.agent_name, l.agent_description
      FROM languages l
      JOIN language_detection_rules r ON l.code = r.default_language_code
      WHERE r.country_code = ? AND r.is_active = 1
      ORDER BY r.priority ASC
      LIMIT 1
    `).bind(countryCode).first();

    if (result) {
      return {
        code: result.code as string,
        name: result.name as string,
        greeting: result.greeting as string,
        flag: result.flag as string,
        greetingAudio: result.greeting_audio_url as string || undefined,
        agentName: result.agent_name as string,
        agentDescription: result.agent_description as string || undefined
      };
    }

    return null;
  }

  // Get user's language preference
  private async getUserLanguagePreference(userId: string): Promise<any> {
    const result = await this.db.prepare(`
      SELECT language_code, cf_country, cf_city, cf_timezone, cf_ip, cf_locale, browser_locale
      FROM user_language_preferences
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).bind(userId).first();

    return result;
  }

  // Save user's language preference
  private async saveUserLanguagePreference(
    userId: string | undefined,
    languageCode: string,
    cfData: CFData,
    browserLocale?: string
  ): Promise<void> {
    if (!userId) return;

    await this.db.prepare(`
      INSERT OR REPLACE INTO user_language_preferences 
      (user_id, language_code, cf_country, cf_city, cf_timezone, cf_ip, cf_locale, browser_locale, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      languageCode,
      cfData.country,
      cfData.city,
      cfData.timezone,
      cfData.ip,
      cfData.locale,
      browserLocale
    ).run();
  }

  // Update user's language preference
  async updateUserLanguagePreference(userId: string, languageCode: string): Promise<void> {
    await this.db.prepare(`
      UPDATE user_language_preferences 
      SET language_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(languageCode, userId).run();

    // Clear cache
    await this.kv.delete(`user_pref:${userId}`);
  }

  // Add new language
  async addLanguage(language: LanguageConfig): Promise<void> {
    await this.db.prepare(`
      INSERT INTO languages (code, name, greeting, greeting_audio_url, flag)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      language.code,
      language.name,
      language.greeting,
      language.greetingAudio,
      language.flag
    ).run();

    // Clear caches
    await this.kv.delete('langs:all');
    await this.kv.delete(`lang:${language.code}`);
  }

  // Update language
  async updateLanguage(code: string, updates: Partial<LanguageConfig>): Promise<void> {
    const fields = [];
    const values = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.greeting) {
      fields.push('greeting = ?');
      values.push(updates.greeting);
    }
    if (updates.greetingAudio !== undefined) {
      fields.push('greeting_audio_url = ?');
      values.push(updates.greetingAudio);
    }
    if (updates.flag) {
      fields.push('flag = ?');
      values.push(updates.flag);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(code);

    await this.db.prepare(`
      UPDATE languages 
      SET ${fields.join(', ')}
      WHERE code = ?
    `).bind(...values).run();

    // Clear caches
    await this.kv.delete('langs:all');
    await this.kv.delete(`lang:${code}`);
  }

  // Delete language
  async deleteLanguage(code: string): Promise<void> {
    await this.db.prepare(`
      UPDATE languages 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `).bind(code).run();

    // Clear caches
    await this.kv.delete('langs:all');
    await this.kv.delete(`lang:${code}`);
  }
}

// API handlers
export async function handleLanguageDetection(
  request: Request,
  db: D1Database,
  kv: KVNamespace
): Promise<Response> {
  try {
    const service = new LanguageService(db, kv);
    const body: LanguageDetectionRequest = await request.json();

    const result = await service.detectLanguage(body);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Language detection failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleGetLanguages(
  request: Request,
  db: D1Database,
  kv: KVNamespace
): Promise<Response> {
  try {
    const service = new LanguageService(db, kv);
    const languages = await service.getAllLanguages();

    return new Response(JSON.stringify({ languages }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to get languages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleUpdateUserLanguage(
  request: Request,
  db: D1Database,
  kv: KVNamespace
): Promise<Response> {
  try {
    const service = new LanguageService(db, kv);
    const body = await request.json() as UpdateUserLanguageRequest;
    const { userId, languageCode } = body;

    await service.updateUserLanguagePreference(userId, languageCode);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to update language preference' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 