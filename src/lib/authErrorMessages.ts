export type AuthFlow = 'login' | 'signup';
export type AuthMessageKey =
  | 'emailRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'passwordTooShort'
  | 'passwordMismatch'
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'accountAlreadyExists'
  | 'tooManyAttempts'
  | 'networkFailure'
  | 'loginFailure'
  | 'signupFailure';

type AuthLanguage = 'en-US' | 'ur-PK' | 'ps-AF';

type AuthMessageSet = Record<AuthMessageKey, string>;

const MESSAGES: Record<AuthLanguage, AuthMessageSet> = {
  'en-US': {
    emailRequired: 'Enter your email address.',
    emailInvalid: 'Enter a valid email address, such as name@example.com.',
    passwordRequired: 'Enter your password.',
    passwordTooShort: 'Choose a password with at least 6 characters.',
    passwordMismatch: 'The passwords do not match.',
    invalidCredentials: 'Email or password is incorrect. Check both and try again.',
    emailNotConfirmed: 'Please verify your email before signing in. Check your inbox.',
    accountAlreadyExists: 'An account with this email may already exist. Try signing in instead.',
    tooManyAttempts: 'There have been too many attempts. Wait a moment and try again.',
    networkFailure: 'Could not connect. Check your internet connection and try again.',
    loginFailure: 'Sign-in failed. Check your details and try again.',
    signupFailure: 'We could not create your account. Check your details and try again.',
  },
  'ur-PK': {
    emailRequired: 'اپنا ای میل ایڈریس درج کریں۔',
    emailInvalid: 'درست ای میل ایڈریس درج کریں، مثلاً name@example.com۔',
    passwordRequired: 'اپنا پاس ورڈ درج کریں۔',
    passwordTooShort: 'کم از کم 6 حروف کا پاس ورڈ منتخب کریں۔',
    passwordMismatch: 'دونوں پاس ورڈ ایک جیسے نہیں ہیں۔',
    invalidCredentials: 'ای میل یا پاس ورڈ درست نہیں۔ دونوں چیک کر کے دوبارہ کوشش کریں۔',
    emailNotConfirmed: 'سائن اِن سے پہلے ای میل کی تصدیق کریں۔ اپنا ان باکس چیک کریں۔',
    accountAlreadyExists: 'ممکن ہے اس ای میل سے اکاؤنٹ پہلے سے موجود ہو۔ لاگ اِن کرنے کی کوشش کریں۔',
    tooManyAttempts: 'کئی کوششیں ہو چکی ہیں۔ کچھ دیر بعد دوبارہ کوشش کریں۔',
    networkFailure: 'رابطہ نہیں ہو سکا۔ انٹرنیٹ چیک کر کے دوبارہ کوشش کریں۔',
    loginFailure: 'لاگ اِن نہیں ہو سکا۔ اپنی معلومات چیک کر کے دوبارہ کوشش کریں۔',
    signupFailure: 'اکاؤنٹ نہیں بن سکا۔ اپنی معلومات چیک کر کے دوبارہ کوشش کریں۔',
  },
  'ps-AF': {
    emailRequired: 'خپل برېښنالیک پته ولیکئ.',
    emailInvalid: 'سم برېښنالیک ولیکئ، لکه name@example.com.',
    passwordRequired: 'خپل پټنوم ولیکئ.',
    passwordTooShort: 'لږ تر لږه ۶ توري لرونکی پټنوم وټاکئ.',
    passwordMismatch: 'دواړه پټنومونه یو شان نه دي.',
    invalidCredentials: 'برېښنالیک یا پټنوم ناسم دی. دواړه وګورئ او بیا هڅه وکړئ.',
    emailNotConfirmed: 'له ننوتلو مخکې خپل برېښنالیک تایید کړئ او انباکس وګورئ.',
    accountAlreadyExists: 'کېدای شي د دې برېښنالیک حساب مخکې جوړ شوی وي. د ننوتلو هڅه وکړئ.',
    tooManyAttempts: 'ډېرې هڅې شوې دي. لږ انتظار وکړئ او بیا هڅه وکړئ.',
    networkFailure: 'اړیکه ونه نښته. انټرنېټ وګورئ او بیا هڅه وکړئ.',
    loginFailure: 'ننوتل بریالي نه شول. معلومات وګورئ او بیا هڅه وکړئ.',
    signupFailure: 'حساب جوړ نه شو. معلومات وګورئ او بیا هڅه وکړئ.',
  },
};

function getLanguage(language: string): AuthLanguage {
  return language === 'ur-PK' || language === 'ps-AF' ? language : 'en-US';
}

export function getAuthMessage(key: AuthMessageKey, language: string): string {
  return MESSAGES[getLanguage(language)][key];
}

export function getAuthErrorMessage(error: unknown, language: string, flow: AuthFlow): string {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : null;
  const message = error instanceof Error
    ? error.message
    : typeof record?.message === 'string'
      ? record.message
      : '';
  const code = typeof record?.code === 'string' ? record.code.toLowerCase() : '';
  const status = typeof record?.status === 'number' ? record.status : undefined;
  const detail = `${code} ${message}`.toLowerCase();

  if (code === 'invalid_credentials' || /invalid login credentials|invalid credentials|incorrect email or password/u.test(detail)) {
    return getAuthMessage('invalidCredentials', language);
  }
  if (code === 'email_not_confirmed' || /email not confirmed|email_not_confirmed/u.test(detail)) {
    return getAuthMessage('emailNotConfirmed', language);
  }
  if (flow === 'signup' && (code === 'user_already_exists' || /user already registered|email already registered|user already exists/u.test(detail))) {
    return getAuthMessage('accountAlreadyExists', language);
  }
  if (status === 429 || /too many requests|rate limit|over_email_send_rate_limit/u.test(detail)) {
    return getAuthMessage('tooManyAttempts', language);
  }
  if (/password should be at least|password too short|weak password/u.test(detail)) {
    return getAuthMessage('passwordTooShort', language);
  }
  if (/invalid email|email address is invalid/u.test(detail)) {
    return getAuthMessage('emailInvalid', language);
  }
  if (error instanceof TypeError || /failed to fetch|network error|fetch failed|connection error|timed? ?out/u.test(detail)) {
    return getAuthMessage('networkFailure', language);
  }

  return getAuthMessage(flow === 'login' ? 'loginFailure' : 'signupFailure', language);
}
