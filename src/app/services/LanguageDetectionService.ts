/**
 * LanguageDetectionService.ts - Multilingual Language Support Service
 * 
 * Provides comprehensive language detection, configuration, and management
 * for the multilingual voice assistant. Supports 12+ Indian languages with
 * native names, greetings, and AI agent configurations.
 * 
 * @author Developer Team
 * @version 1.0.0
 */

/**
 * Language configuration interface for voice assistant
 * 
 * Defines the structure for language-specific settings including:
 * - Language codes and names (English and native)
 * - Greeting messages and audio files
 * - Visual elements (flags, emojis)
 * - AI agent names and descriptions
 */
export interface LanguageConfig {
    code: string;
    name: string;
    nativeName: string;
    greeting: string;
    greetingAudio?: string;
    flag?: string;
    emoji?: string;
    agentName: string;
    agentDescription?: string;
  }

  // Indian language codes
  const INDIAN_LANGUAGE_CODES = [
    'en', 'hi', 'ta', 'bn', 'te', 'mr', 'kn', 'gu', 'ml', 'pa', 'or', 'as', 'ur'
  ];
  
  export const DEFAULT_LANGUAGES: LanguageConfig[] = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      greeting: 'How may I help you today?',
      flag: '🇺🇸',
      emoji: '🇺🇸',
      agentName: 'Drishthi',
      agentDescription: 'Your English-speaking AI assistant'
    },
    {
      code: 'hi',
      name: 'Hindi',
      nativeName: 'हिन्दी',
      greeting: 'मैं आपकी कैसे मदद कर सकती हूं',
      flag: '🇮🇳',
      emoji: '🇮🇳',
      agentName: 'प्रिया',
      agentDescription: 'आपकी हिंदी AI सहायक'
    },
    {
      code: 'ta',
      name: 'Tamil',
      nativeName: 'தமிழ்',
      greeting: 'நான் உங்களுக்கு எப்படி உதவ முடியும்',
      flag: '🇮🇳',
      emoji: '🌿',
      agentName: 'தேவி',
      agentDescription: 'உங்கள் தமிழ் AI உதவியாளர்'
    },
    {
      code: 'bn',
      name: 'Bengali',
      nativeName: 'বাংলা',
      greeting: 'আমি আপনাকে কীভাবে সাহায্য করতে পারি',
      flag: '🇮🇳',
      emoji: '🪔',
      agentName: 'রিয়া',
      agentDescription: 'আপনার বাংলা AI সহকারী'
    },
    {
      code: 'te',
      name: 'Telugu',
      nativeName: 'తెలుగు',
      greeting: 'నేను మీకు ఎలా సహాయం చేయగలను',
      flag: '🇮🇳',
      emoji: '🪷',
      agentName: 'లక్ష్మి',
      agentDescription: 'మీ తెలుగు AI సహాయకుడు'
    },
    {
      code: 'mr',
      name: 'Marathi',
      nativeName: 'मराठी',
      greeting: 'मी तुमची कशी मदत करू शकतो',
      flag: '🇮🇳',
      emoji: '🌊',
      agentName: 'माया',
      agentDescription: 'तुमची मराठी AI सहायक'
    },
    {
      code: 'kn',
      name: 'Kannada',
      nativeName: 'ಕನ್ನಡ',
      greeting: 'ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು',
      flag: '🇮🇳',
      emoji: '🏮',
      agentName: 'ಕಾವ್ಯ',
      agentDescription: 'ನಿಮ್ಮ ಕನ್ನಡ AI ಸಹಾಯಕ'
    },
    {
      code: 'gu',
      name: 'Gujarati',
      nativeName: 'ગુજરાતી',
      greeting: 'હું તમને કેવી રીતે મદદ કરી શકું',
      flag: '🇮🇳',
      emoji: '🪶',
      agentName: 'દિયા',
      agentDescription: 'તમારી ગુજરાતી AI સહાયક'
    },
    {
      code: 'ml',
      name: 'Malayalam',
      nativeName: 'മലയാളം',
      greeting: 'ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം',
      flag: '🇮🇳',
      emoji: '🌴',
      agentName: 'മാല',
      agentDescription: 'നിങ്ങളുടെ മലയാളം AI സഹായി'
    },
    {
      code: 'pa',
      name: 'Punjabi',
      nativeName: 'ਪੰਜਾਬੀ',
      greeting: 'ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ',
      flag: '🇮🇳',
      emoji: '🎵',
      agentName: 'ਸੀਮਾ',
      agentDescription: 'ਤੁਹਾਡੀ ਪੰਜਾਬੀ AI ਸਹਾਇਕ'
    },
    {
      code: 'or',
      name: 'Odia',
      nativeName: 'ଓଡ଼ିଆ',
      greeting: 'ମୁଁ ଆପଣଙ୍କୁ କିପରି ସହାୟତା କରିପାରେ',
      flag: '🇮🇳',
      emoji: '🌺',
      agentName: 'ପ୍ରିୟା',
      agentDescription: 'ଆପଣଙ୍କ ଓଡ଼ିଆ AI ସହାୟକ'
    },
    {
      code: 'as',
      name: 'Assamese',
      nativeName: 'অসমীয়া',
      greeting: 'মই আপোনাক কেনেকৈ সহায় কৰিব পাৰোঁ',
      flag: '🇮🇳',
      emoji: '🌾',
      agentName: 'প্ৰিয়া',
      agentDescription: 'আপোনাৰ অসমীয়া AI সহায়ক'
    },
    {
      code: 'ur',
      name: 'Urdu',
      nativeName: 'اردو',
      greeting: 'میں آپ کی کیسے مدد کر سکتا ہوں',
      flag: '🇮🇳',
      emoji: '📖',
      agentName: 'فاطمہ',
      agentDescription: 'آپ کی اردو AI معاون'
    },
    {
      code: 'ne',
      name: 'Nepali',
      nativeName: 'नेपाली',
      greeting: 'म तपाईंलाई कसरी मद्दत गर्न सक्छु',
      flag: '🇳🇵',
      emoji: '🏔️',
      agentName: 'सुनीता',
      agentDescription: 'तपाईंको नेपाली AI सहायक'
    },
    {
      code: 'si',
      name: 'Sinhala',
      nativeName: 'සිංහල',
      greeting: 'මට ඔබට කෙසේ උදව් කළ හැකිද',
      flag: '🇱🇰',
      emoji: '🌅',
      agentName: 'කුමුදිනි',
      agentDescription: 'ඔබගේ සිංහල AI සහායක'
    },
    {
      code: 'my',
      name: 'Myanmar',
      nativeName: 'မြန်မာ',
      greeting: 'ကျွန်တော် သင့်ကို ဘယ်လို ကူညီနိုင်မလဲ',
      flag: '🇲🇲',
      emoji: '🌙',
      agentName: 'သီရိ',
      agentDescription: 'သင့်ရဲ့ မြန်မာ AI အကူအညီ'
    },
    {
      code: 'th',
      name: 'Thai',
      nativeName: 'ไทย',
      greeting: 'ฉันจะช่วยคุณได้อย่างไร',
      flag: '🇹🇭',
      emoji: '🐘',
      agentName: 'นารี',
      agentDescription: 'ผู้ช่วย AI ภาษาไทยของคุณ'
    },
    {
      code: 'vi',
      name: 'Vietnamese',
      nativeName: 'Tiếng Việt',
      greeting: 'Tôi có thể giúp bạn như thế nào',
      flag: '🇻🇳',
      emoji: '🌿',
      agentName: 'Mai',
      agentDescription: 'Trợ lý AI tiếng Việt của bạn'
    },
    {
      code: 'id',
      name: 'Indonesian',
      nativeName: 'Bahasa Indonesia',
      greeting: 'Bagaimana saya bisa membantu Anda',
      flag: '🇮🇩',
      emoji: '🌺',
      agentName: 'Sari',
      agentDescription: 'Asisten AI Bahasa Indonesia Anda'
    },
    {
      code: 'ms',
      name: 'Malay',
      nativeName: 'Bahasa Melayu',
      greeting: 'Bagaimana saya boleh membantu anda',
      flag: '🇲🇾',
      emoji: '🌴',
      agentName: 'Aminah',
      agentDescription: 'Pembantu AI Bahasa Melayu anda'
    },
    {
      code: 'tl',
      name: 'Filipino',
      nativeName: 'Filipino',
      greeting: 'Paano ko kayo matutulungan',
      flag: '🇵🇭',
      emoji: '🌺',
      agentName: 'Maria',
      agentDescription: 'Ang iyong Filipino AI assistant'
    },
    {
      code: 'km',
      name: 'Khmer',
      nativeName: 'ខ្មែរ',
      greeting: 'ខ្ញុំអាចជួយអ្នកបានយ៉ាងណា',
      flag: '🇰🇭',
      emoji: '🏛️',
      agentName: 'សុភា',
      agentDescription: 'អ្នកជំនួយ AI ខ្មែររបស់អ្នក'
    },
    {
      code: 'lo',
      name: 'Lao',
      nativeName: 'ລາວ',
      greeting: 'ຂ້ອຍສາມາດຊ່ວຍທ່ານໄດ້ແນວໃດ',
      flag: '🇱🇦',
      emoji: '🐘',
      agentName: 'ສົມສະໄໝ',
      agentDescription: 'ຜູ້ຊ່ວຍ AI ລາວຂອງທ່ານ'
    },
    {
      code: 'zh',
      name: 'Chinese',
      nativeName: '中文',
      greeting: '我如何能帮助您',
      flag: '🇨🇳',
      emoji: '🐉',
      agentName: '小华',
      agentDescription: '您的中文AI助手'
    },
    {
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      greeting: 'どのようにお手伝いできますか',
      flag: '🇯🇵',
      emoji: '🌸',
      agentName: 'さくら',
      agentDescription: 'あなたの日本語AIアシスタント'
    },
    {
      code: 'ko',
      name: 'Korean',
      nativeName: '한국어',
      greeting: '어떻게 도와드릴까요',
      flag: '🇰🇷',
      emoji: '🌺',
      agentName: '민지',
      agentDescription: '당신의 한국어 AI 어시스턴트'
    },
    {
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      greeting: 'كيف يمكنني مساعدتك',
      flag: '🇸🇦',
      emoji: '🌙',
      agentName: 'فاطمة',
      agentDescription: 'مساعدك الذكي باللغة العربية'
    },
    {
      code: 'fa',
      name: 'Persian',
      nativeName: 'فارسی',
      greeting: 'چگونه می‌توانم به شما کمک کنم',
      flag: '🇮🇷',
      emoji: '🌹',
      agentName: 'پریا',
      agentDescription: 'دستیار هوشمند فارسی شما'
    },
    {
      code: 'tr',
      name: 'Turkish',
      nativeName: 'Türkçe',
      greeting: 'Size nasıl yardımcı olabilirim',
      flag: '🇹🇷',
      emoji: '🌺',
      agentName: 'Ayşe',
      agentDescription: 'Türkçe AI asistanınız'
    },
    {
      code: 'ru',
      name: 'Russian',
      nativeName: 'Русский',
      greeting: 'Как я могу вам помочь',
      flag: '🇷🇺',
      emoji: '❄️',
      agentName: 'Анна',
      agentDescription: 'Ваш русский AI помощник'
    },
    {
      code: 'de',
      name: 'German',
      nativeName: 'Deutsch',
      greeting: 'Wie kann ich Ihnen helfen',
      flag: '🇩🇪',
      emoji: '🍺',
      agentName: 'Anna',
      agentDescription: 'Ihr deutscher AI-Assistent'
    },
    {
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      greeting: 'Comment puis-je vous aider',
      flag: '🇫🇷',
      emoji: '🥖',
      agentName: 'Sophie',
      agentDescription: 'Votre assistant IA français'
    },
    {
      code: 'es',
      name: 'Spanish',
      nativeName: 'Español',
      greeting: '¿Cómo puedo ayudarte',
      flag: '🇪🇸',
      emoji: '🌞',
      agentName: 'Sofia',
      agentDescription: 'Tu asistente de IA en español'
    },
    {
      code: 'pt',
      name: 'Portuguese',
      nativeName: 'Português',
      greeting: 'Como posso ajudá-lo',
      flag: '🇵🇹',
      emoji: '🌊',
      agentName: 'Maria',
      agentDescription: 'Seu assistente de IA em português'
    },
    {
      code: 'it',
      name: 'Italian',
      nativeName: 'Italiano',
      greeting: 'Come posso aiutarti',
      flag: '🇮🇹',
      emoji: '🍕',
      agentName: 'Sofia',
      agentDescription: 'Il tuo assistente AI italiano'
    },
    {
      code: 'nl',
      name: 'Dutch',
      nativeName: 'Nederlands',
      greeting: 'Hoe kan ik u helpen',
      flag: '🇳🇱',
      emoji: '🌷',
      agentName: 'Emma',
      agentDescription: 'Uw Nederlandse AI-assistent'
    },
    {
      code: 'sv',
      name: 'Swedish',
      nativeName: 'Svenska',
      greeting: 'Hur kan jag hjälpa dig',
      flag: '🇸🇪',
      emoji: '🦊',
      agentName: 'Eva',
      agentDescription: 'Din svenska AI-assistent'
    },
    {
      code: 'da',
      name: 'Danish',
      nativeName: 'Dansk',
      greeting: 'Hvordan kan jeg hjælpe dig',
      flag: '🇩🇰',
      emoji: '🧀',
      agentName: 'Mette',
      agentDescription: 'Din danske AI-assistent'
    },
    {
      code: 'no',
      name: 'Norwegian',
      nativeName: 'Norsk',
      greeting: 'Hvordan kan jeg hjelpe deg',
      flag: '🇳🇴',
      emoji: '🏔️',
      agentName: 'Ingrid',
      agentDescription: 'Din norske AI-assistent'
    },
    {
      code: 'fi',
      name: 'Finnish',
      nativeName: 'Suomi',
      greeting: 'Miten voin auttaa sinua',
      flag: '🇫🇮',
      emoji: '🦊',
      agentName: 'Aino',
      agentDescription: 'Sinun suomenkielinen AI-avustaja'
    },
    {
      code: 'pl',
      name: 'Polish',
      nativeName: 'Polski',
      greeting: 'Jak mogę Ci pomóc',
      flag: '🇵🇱',
      emoji: '🦅',
      agentName: 'Anna',
      agentDescription: 'Twój polski asystent AI'
    },
    {
      code: 'cs',
      name: 'Czech',
      nativeName: 'Čeština',
      greeting: 'Jak vám mohu pomoci',
      flag: '🇨🇿',
      emoji: '🍺',
      agentName: 'Tereza',
      agentDescription: 'Váš český AI asistent'
    },
    {
      code: 'sk',
      name: 'Slovak',
      nativeName: 'Slovenčina',
      greeting: 'Ako vám môžem pomôcť',
      flag: '🇸🇰',
      emoji: '🏔️',
      agentName: 'Mária',
      agentDescription: 'Váš slovenský AI asistent'
    },
    {
      code: 'hu',
      name: 'Hungarian',
      nativeName: 'Magyar',
      greeting: 'Hogyan segíthetek',
      flag: '🇭🇺',
      emoji: '🌶️',
      agentName: 'Zsuzsa',
      agentDescription: 'Az Ön magyar AI asszisztense'
    },
    {
      code: 'ro',
      name: 'Romanian',
      nativeName: 'Română',
      greeting: 'Cum vă pot ajuta',
      flag: '🇷🇴',
      emoji: '🏰',
      agentName: 'Maria',
      agentDescription: 'Asistentul dvs. AI în română'
    },
    {
      code: 'bg',
      name: 'Bulgarian',
      nativeName: 'Български',
      greeting: 'Как мога да ви помогна',
      flag: '🇧🇬',
      emoji: '🌹',
      agentName: 'Мария',
      agentDescription: 'Вашият български AI асистент'
    },
    {
      code: 'hr',
      name: 'Croatian',
      nativeName: 'Hrvatski',
      greeting: 'Kako vam mogu pomoći',
      flag: '🇭🇷',
      emoji: '🌊',
      agentName: 'Marija',
      agentDescription: 'Vaš hrvatski AI asistent'
    },
    {
      code: 'sr',
      name: 'Serbian',
      nativeName: 'Српски',
      greeting: 'Како могу да вам помогнем',
      flag: '🇷🇸',
      emoji: '🦅',
      agentName: 'Марија',
      agentDescription: 'Ваш српски AI асистент'
    },
    {
      code: 'sl',
      name: 'Slovenian',
      nativeName: 'Slovenščina',
      greeting: 'Kako vam lahko pomagam',
      flag: '🇸🇮',
      emoji: '🏔️',
      agentName: 'Maja',
      agentDescription: 'Vaš slovenski AI asistent'
    },
    {
      code: 'et',
      name: 'Estonian',
      nativeName: 'Eesti',
      greeting: 'Kuidas saan teid aidata',
      flag: '🇪🇪',
      emoji: '🌲',
      agentName: 'Mari',
      agentDescription: 'Teie eestikeelne AI abiline'
    },
    {
      code: 'lv',
      name: 'Latvian',
      nativeName: 'Latviešu',
      greeting: 'Kā es varu jums palīdzēt',
      flag: '🇱🇻',
      emoji: '🌲',
      agentName: 'Marta',
      agentDescription: 'Jūsu latviešu AI asistents'
    },
    {
      code: 'lt',
      name: 'Lithuanian',
      nativeName: 'Lietuvių',
      greeting: 'Kaip galiu jums padėti',
      flag: '🇱🇹',
      emoji: '🌲',
      agentName: 'Marija',
      agentDescription: 'Jūsų lietuvių AI asistentas'
    },
    {
      code: 'mt',
      name: 'Maltese',
      nativeName: 'Malti',
      greeting: 'Kif nista\' ngħinek',
      flag: '🇲🇹',
      emoji: '🌊',
      agentName: 'Marija',
      agentDescription: 'L-assistent AI tiegħek bil-Malti'
    },
    {
      code: 'ga',
      name: 'Irish',
      nativeName: 'Gaeilge',
      greeting: 'Conas is féidir liom cabhrú leat',
      flag: '🇮🇪',
      emoji: '☘️',
      agentName: 'Siobhán',
      agentDescription: 'Do chúntóir AI Gaeilge'
    },
    {
      code: 'cy',
      name: 'Welsh',
      nativeName: 'Cymraeg',
      greeting: 'Sut alla i eich helpu',
      flag: '🇬🇧',
      emoji: '🐉',
      agentName: 'Gwen',
      agentDescription: 'Eich cynorthwyydd AI Cymraeg'
    },
    {
      code: 'is',
      name: 'Icelandic',
      nativeName: 'Íslenska',
      greeting: 'Hvernig get ég hjálpað þér',
      flag: '🇮🇸',
      emoji: '🌋',
      agentName: 'Helga',
      agentDescription: 'Þinn íslenski AI aðstoðarmaður'
    },
    {
      code: 'he',
      name: 'Hebrew',
      nativeName: 'עברית',
      greeting: 'איך אני יכול לעזור לך',
      flag: '🇮🇱',
      emoji: '✡️',
      agentName: 'שירה',
      agentDescription: 'העוזר האינטליגנטי שלך בעברית'
    },
    {
      code: 'el',
      name: 'Greek',
      nativeName: 'Ελληνικά',
      greeting: 'Πώς μπορώ να σας βοηθήσω',
      flag: '🇬🇷',
      emoji: '🏛️',
      agentName: 'Μαρία',
      agentDescription: 'Ο ελληνικός AI βοηθός σας'
    },
    {
      code: 'uk',
      name: 'Ukrainian',
      nativeName: 'Українська',
      greeting: 'Як я можу вам допомогти',
      flag: '🇺🇦',
      emoji: '🌻',
      agentName: 'Марія',
      agentDescription: 'Ваш український AI помічник'
    },
    {
      code: 'be',
      name: 'Belarusian',
      nativeName: 'Беларуская',
      greeting: 'Як я магу вам дапамагчы',
      flag: '🇧🇾',
      emoji: '🌾',
      agentName: 'Марыя',
      agentDescription: 'Ваш беларускі AI памочнік'
    },
    {
      code: 'mk',
      name: 'Macedonian',
      nativeName: 'Македонски',
      greeting: 'Како можам да ви помогнам',
      flag: '🇲🇰',
      emoji: '🏔️',
      agentName: 'Марија',
      agentDescription: 'Вашиот македонски AI асистент'
    },
    {
      code: 'sq',
      name: 'Albanian',
      nativeName: 'Shqip',
      greeting: 'Si mund t\'ju ndihmoj',
      flag: '🇦🇱',
      emoji: '🦅',
      agentName: 'Marija',
      agentDescription: 'Asistenti juaj AI në shqip'
    },
    {
      code: 'bs',
      name: 'Bosnian',
      nativeName: 'Bosanski',
      greeting: 'Kako vam mogu pomoći',
      flag: '🇧🇦',
      emoji: '🌊',
      agentName: 'Marija',
      agentDescription: 'Vaš bosanski AI asistent'
    },
    {
      code: 'me',
      name: 'Montenegrin',
      nativeName: 'Crnogorski',
      greeting: 'Kako vam mogu pomoći',
      flag: '🇲🇪',
      emoji: '🌊',
      agentName: 'Marija',
      agentDescription: 'Vaš crnogorski AI asistent'
    },
    {
      code: 'ka',
      name: 'Georgian',
      nativeName: 'ქართული',
      greeting: 'როგორ შემიძლია დაგეხმაროთ',
      flag: '🇬🇪',
      emoji: '🍇',
      agentName: 'ნინო',
      agentDescription: 'თქვენი ქართული AI ასისტენტი'
    },
    {
      code: 'hy',
      name: 'Armenian',
      nativeName: 'Հայերեն',
      greeting: 'Ինչպես կարող եմ օգնել ձեզ',
      flag: '🇦🇲',
      emoji: '🏔️',
      agentName: 'Անի',
      agentDescription: 'Ձեր հայերեն AI օգնականը'
    },
    {
      code: 'az',
      name: 'Azerbaijani',
      nativeName: 'Azərbaycan',
      greeting: 'Sizə necə kömək edə bilərəm',
      flag: '🇦🇿',
      emoji: '🔥',
      agentName: 'Aysu',
      agentDescription: 'Sizin Azərbaycan AI köməkçiniz'
    },
    {
      code: 'kk',
      name: 'Kazakh',
      nativeName: 'Қазақ',
      greeting: 'Сізге қалай көмектесе аламын',
      flag: '🇰🇿',
      emoji: '🐺',
      agentName: 'Айгүл',
      agentDescription: 'Сіздің қазақ AI көмекшісіңіз'
    },
    {
      code: 'ky',
      name: 'Kyrgyz',
      nativeName: 'Кыргызча',
      greeting: 'Сизге кантип жардам бере алам',
      flag: '🇰🇬',
      emoji: '🏔️',
      agentName: 'Айгүл',
      agentDescription: 'Сиздин кыргыз AI жардамчыңыз'
    },
    {
      code: 'uz',
      name: 'Uzbek',
      nativeName: 'O\'zbek',
      greeting: 'Sizga qanday yordam bera olaman',
      flag: '🇺🇿',
      emoji: '🌙',
      agentName: 'Gulnora',
      agentDescription: 'Sizning o\'zbek AI yordamchingiz'
    },
    {
      code: 'tg',
      name: 'Tajik',
      nativeName: 'Тоҷикӣ',
      greeting: 'Чӣ тавр ман метавонам ба шумо кӯмак кунам',
      flag: '🇹🇯',
      emoji: '🏔️',
      agentName: 'Гулнора',
      agentDescription: 'Ёрирасон AI тоҷикии шумо'
    },
    {
      code: 'tk',
      name: 'Turkmen',
      nativeName: 'Türkmençe',
      greeting: 'Size nädip kömek edip bilerin',
      flag: '🇹🇲',
      emoji: '🐪',
      agentName: 'Gulnara',
      agentDescription: 'Siziň türkmen AI ýardamçyňyz'
    },
    {
      code: 'mn',
      name: 'Mongolian',
      nativeName: 'Монгол',
      greeting: 'Би танд хэрхэн тусалж болох вэ',
      flag: '🇲🇳',
      emoji: '🐎',
      agentName: 'Батцэцэг',
      agentDescription: 'Таны монгол AI туслах'
    },
    {
      code: 'am',
      name: 'Amharic',
      nativeName: 'አማርኛ',
      greeting: 'እንዴት ልረዳዎት እችላለሁ',
      flag: '🇪🇹',
      emoji: '☕',
      agentName: 'ሰላም',
      agentDescription: 'የእርስዎ አማርኛ AI አገልግሎት'
    },
    {
      code: 'sw',
      name: 'Swahili',
      nativeName: 'Kiswahili',
      greeting: 'Ninawezaje kukusaidia',
      flag: '🇹🇿',
      emoji: '🦁',
      agentName: 'Aisha',
      agentDescription: 'Msaidizi wako wa AI wa Kiswahili'
    },
    {
      code: 'yo',
      name: 'Yoruba',
      nativeName: 'Yorùbá',
      greeting: 'Báwo ni mo ṣe le rànwọ́ fún ọ',
      flag: '🇳🇬',
      emoji: '🌺',
      agentName: 'Folake',
      agentDescription: 'Olùrànlọ́wọ́ AI rẹ ni èdè Yorùbá'
    },
    {
      code: 'ig',
      name: 'Igbo',
      nativeName: 'Igbo',
      greeting: 'Kedu ka m ga-esi nyere gị aka',
      flag: '🇳🇬',
      emoji: '🌺',
      agentName: 'Chioma',
      agentDescription: 'Onye enyemaka AI gị n\'asụsụ Igbo'
    },
    {
      code: 'ha',
      name: 'Hausa',
      nativeName: 'Hausa',
      greeting: 'Yaya zan iya taimaka maka',
      flag: '🇳🇬',
      emoji: '🌺',
      agentName: 'Fatima',
      agentDescription: 'Mataimakin AI naka na Hausa'
    },
    {
      code: 'zu',
      name: 'Zulu',
      nativeName: 'isiZulu',
      greeting: 'Ngingakusiza kanjani',
      flag: '🇿🇦',
      emoji: '🦁',
      agentName: 'Nokuthula',
      agentDescription: 'Umsizi wakho we-AI ngesiZulu'
    },
    {
      code: 'xh',
      name: 'Xhosa',
      nativeName: 'isiXhosa',
      greeting: 'Ndingakunceda njani',
      flag: '🇿🇦',
      emoji: '🦁',
      agentName: 'Noluthando',
      agentDescription: 'Umncedi wakho we-AI ngesiXhosa'
    },
    {
      code: 'af',
      name: 'Afrikaans',
      nativeName: 'Afrikaans',
      greeting: 'Hoe kan ek u help',
      flag: '🇿🇦',
      emoji: '🦁',
      agentName: 'Marietjie',
      agentDescription: 'U Afrikaanse AI-assistent'
    },
    {
      code: 'st',
      name: 'Sotho',
      nativeName: 'Sesotho',
      greeting: 'Ke ka u thusa jwang',
      flag: '🇿🇦',
      emoji: '🦁',
      agentName: 'Mpho',
      agentDescription: 'Mothusi wa hao wa AI ka Sesotho'
    },
    {
      code: 'tn',
      name: 'Tswana',
      nativeName: 'Setswana',
      greeting: 'Ke ka go thusa jang',
      flag: '🇿🇦',
      emoji: '🦁',
      agentName: 'Boitumelo',
      agentDescription: 'Mothusi wa gago wa AI ka Setswana'
    },
    {
      code: 'ss',
      name: 'Swati',
      nativeName: 'siSwati',
      greeting: 'Ngingakusita njani',
      flag: '🇸🇿',
      emoji: '🦁',
      agentName: 'Nokuthula',
      agentDescription: 'Umsizi wakho we-AI ngesiSwati'
    },
    {
      code: 've',
      name: 'Venda',
      nativeName: 'Tshivenda',
      greeting: 'Ndi nga u thusa hani',
      flag: '🇿🇦',
      emoji: '🦁',
      agentName: 'Mudzunga',
      agentDescription: 'Muthusi wa vhau wa AI nga Tshivenda'
    },
    {
      code: 'ts',
      name: 'Tsonga',
      nativeName: 'Xitsonga',
      greeting: 'Ndza ku pfuna njhani',
      flag: '🇿🇦',
      emoji: '🦁',
      agentName: 'Ntsakisi',
      agentDescription: 'Mupfuni wa wena wa AI hi Xitsonga'
    },
    {
      code: 'nr',
      name: 'Ndebele',
      nativeName: 'isiNdebele',
      greeting: 'Ngingakusiza kanjani',
      flag: '🇿🇦',
      emoji: '🦁',
      agentName: 'Nokuthula',
      agentDescription: 'Umsizi wakho we-AI ngesiNdebele'
    }
  ];

  /**
   * Get only Indian languages for display
   * 
   * Filters the complete language list to return only Indian languages
   * that are supported by the voice assistant. This is used for the
   * language selection UI.
   * 
   * @returns {LanguageConfig[]} Array of supported Indian languages
   */
  export const getIndianLanguages = (): LanguageConfig[] => {
    return DEFAULT_LANGUAGES.filter(lang => INDIAN_LANGUAGE_CODES.includes(lang.code));
  };

  // Get all languages (for backend functionality)
  export const getAllLanguages = (): LanguageConfig[] => {
    return DEFAULT_LANGUAGES;
  };
  
  export interface CFData {
    country: string;
    city?: string;
    timezone?: string;
    ip?: string;
    locale?: string;
  }
  
  /**
   * Language Detection Service Class
   * 
   * Singleton service for managing language detection, user preferences,
   * and language configuration. Provides methods for detecting user's
   * preferred language based on Cloudflare data and managing language
   * settings throughout the application.
   */
  export class LanguageDetectionService {
    private static instance: LanguageDetectionService;
    private languages: LanguageConfig[] = DEFAULT_LANGUAGES;
    private userLanguage: LanguageConfig = DEFAULT_LANGUAGES[0];
  
    private constructor() {}
  
    static getInstance(): LanguageDetectionService {
      if (!LanguageDetectionService.instance) {
        LanguageDetectionService.instance = new LanguageDetectionService();
      }
      return LanguageDetectionService.instance;
    }
  
    /**
     * Detect user's preferred language based on Cloudflare data
     * 
     * Analyzes Cloudflare request data to determine the user's
     * preferred language based on their locale settings.
     * Falls back to user's manually selected language if no
     * Cloudflare data is available.
     * 
     * @param {CFData} cfData - Cloudflare request data containing locale info
     * @returns {LanguageConfig} Detected or fallback language configuration
     */
    detectLanguage(cfData?: CFData): LanguageConfig {
      if (!cfData) {
        return this.userLanguage;
      }
  
      if (cfData.locale) {
        const exactMatch = this.languages.find(lang => 
          cfData.locale?.startsWith(lang.code + '-') || cfData.locale === lang.code
        );
        if (exactMatch) {
          return exactMatch;
        }
      }
  
      return this.userLanguage;
    }
  
    getLanguages(): LanguageConfig[] {
      return this.languages;
    }

    // Get only Indian languages for display
    getIndianLanguages(): LanguageConfig[] {
      return this.languages.filter(lang => INDIAN_LANGUAGE_CODES.includes(lang.code));
    }
  
    setUserLanguage(language: LanguageConfig) {
      this.userLanguage = language;
    }
  
    getUserLanguage(): LanguageConfig {
      return this.userLanguage;
    }
  
    addLanguage(language: LanguageConfig) {
      this.languages.push(language);
    }
  }