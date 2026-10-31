export const hankoIdentityLocales = [
  "en",
  "fr",
  "es",
  "de",
  "it",
  "pt-BR",
  "ar",
  "he",
] as const;
export type HankoIdentityLocale = (typeof hankoIdentityLocales)[number];
export function resolveHankoIdentityLocale(
  value?: string,
): HankoIdentityLocale {
  try {
    const tag = new Intl.Locale(value || "en").toString();
    if ((hankoIdentityLocales as readonly string[]).includes(tag))
      return tag as HankoIdentityLocale;
    const base = tag.split("-")[0];
    if (base === "pt") return "pt-BR";
    if ((hankoIdentityLocales as readonly string[]).includes(base!))
      return base as HankoIdentityLocale;
  } catch {
    /* Unknown or invalid language tags fall back to English. */
  }
  return "en";
}
export function hankoIdentityDirection(locale?: string): "ltr" | "rtl" {
  return ["ar", "he"].includes(resolveHankoIdentityLocale(locale))
    ? "rtl"
    : "ltr";
}
export const additionalHankoIdentityMessages = {
  es: {
    profile: "Mi perfil",
    organizations: "Organizaciones",
    access: "Mis accesos",
    security: "Seguridad",
    loading: "Cargando…",
    retry: "Reintentar",
    unavailable: "Esta información no está disponible.",
    empty: "No hay organizaciones disponibles para tu cuenta.",
    name: "Nombre",
    email: "Correo electrónico",
    role: "Rol",
    members: "Miembros",
    save: "Guardar",
    saved: "Guardado.",
    cancel: "Cancelar",
    remove: "Eliminar",
    confirm: "Confirmar eliminación",
    create: "Crear organización",
    slug: "Identificador",
    description: "Descripción",
    website: "Sitio web",
    invite: "Invitar",
    edit: "Editar mis datos",
    password: "Cambiar contraseña",
    otp: "Configurar un autenticador",
    logout: "Cerrar sesión",
    noRoles: "No hay ningún rol asignado.",
    resources: "Recursos",
    actions: "Acciones",
    noMembers: "Todavía no hay miembros.",
    details: "Datos de la organización",
    readOnly: "Tienes acceso de solo lectura a esta organización.",
  },
  de: {
    profile: "Mein Profil",
    organizations: "Organisationen",
    access: "Meine Zugriffe",
    security: "Sicherheit",
    loading: "Laden…",
    retry: "Erneut versuchen",
    unavailable: "Diese Informationen sind nicht verfügbar.",
    empty: "Für Ihr Konto ist keine Organisation verfügbar.",
    name: "Name",
    email: "E-Mail",
    role: "Rolle",
    members: "Mitglieder",
    save: "Speichern",
    saved: "Gespeichert.",
    cancel: "Abbrechen",
    remove: "Entfernen",
    confirm: "Entfernen bestätigen",
    create: "Organisation erstellen",
    slug: "Kennung",
    description: "Beschreibung",
    website: "Webseite",
    invite: "Einladen",
    edit: "Meine Daten bearbeiten",
    password: "Passwort ändern",
    otp: "Authentifikator einrichten",
    logout: "Abmelden",
    noRoles: "Keine Rolle zugewiesen.",
    resources: "Ressourcen",
    actions: "Aktionen",
    noMembers: "Noch keine Mitglieder.",
    details: "Organisationsdetails",
    readOnly: "Sie haben nur Lesezugriff auf diese Organisation.",
  },
  it: {
    profile: "Il mio profilo",
    organizations: "Organizzazioni",
    access: "I miei accessi",
    security: "Sicurezza",
    loading: "Caricamento…",
    retry: "Riprova",
    unavailable: "Queste informazioni non sono disponibili.",
    empty: "Nessuna organizzazione è disponibile per il tuo account.",
    name: "Nome",
    email: "Email",
    role: "Ruolo",
    members: "Membri",
    save: "Salva",
    saved: "Salvato.",
    cancel: "Annulla",
    remove: "Rimuovi",
    confirm: "Conferma rimozione",
    create: "Crea organizzazione",
    slug: "Identificatore",
    description: "Descrizione",
    website: "Sito web",
    invite: "Invita",
    edit: "Modifica i miei dati",
    password: "Cambia password",
    otp: "Configura un autenticatore",
    logout: "Esci",
    noRoles: "Nessun ruolo assegnato.",
    resources: "Risorse",
    actions: "Azioni",
    noMembers: "Nessun membro presente.",
    details: "Dettagli organizzazione",
    readOnly: "Hai accesso in sola lettura a questa organizzazione.",
  },
  "pt-BR": {
    profile: "Meu perfil",
    organizations: "Organizações",
    access: "Meus acessos",
    security: "Segurança",
    loading: "Carregando…",
    retry: "Tentar novamente",
    unavailable: "Estas informações não estão disponíveis.",
    empty: "Nenhuma organização está disponível para sua conta.",
    name: "Nome",
    email: "E-mail",
    role: "Função",
    members: "Membros",
    save: "Salvar",
    saved: "Salvo.",
    cancel: "Cancelar",
    remove: "Remover",
    confirm: "Confirmar remoção",
    create: "Criar organização",
    slug: "Identificador",
    description: "Descrição",
    website: "Site",
    invite: "Convidar",
    edit: "Editar meus dados",
    password: "Alterar senha",
    otp: "Configurar um autenticador",
    logout: "Sair",
    noRoles: "Nenhuma função atribuída.",
    resources: "Recursos",
    actions: "Ações",
    noMembers: "Ainda não há membros.",
    details: "Dados da organização",
    readOnly: "Você tem acesso somente de leitura a esta organização.",
  },
  ar: {
    profile: "ملفي الشخصي",
    organizations: "المؤسسات",
    access: "صلاحيات الوصول",
    security: "الأمان",
    loading: "جارٍ التحميل…",
    retry: "إعادة المحاولة",
    unavailable: "هذه المعلومات غير متاحة.",
    empty: "لا توجد مؤسسة متاحة لحسابك.",
    name: "الاسم",
    email: "البريد الإلكتروني",
    role: "الدور",
    members: "الأعضاء",
    save: "حفظ",
    saved: "تم الحفظ.",
    cancel: "إلغاء",
    remove: "إزالة",
    confirm: "تأكيد الإزالة",
    create: "إنشاء مؤسسة",
    slug: "المعرّف",
    description: "الوصف",
    website: "الموقع الإلكتروني",
    invite: "دعوة",
    edit: "تعديل معلوماتي",
    password: "تغيير كلمة المرور",
    otp: "إعداد تطبيق مصادقة",
    logout: "تسجيل الخروج",
    noRoles: "لم يتم تعيين أي دور.",
    resources: "الموارد",
    actions: "الإجراءات",
    noMembers: "لا يوجد أعضاء بعد.",
    details: "تفاصيل المؤسسة",
    readOnly: "لديك صلاحية القراءة فقط في هذه المؤسسة.",
  },
  he: {
    profile: "הפרופיל שלי",
    organizations: "ארגונים",
    access: "הגישה שלי",
    security: "אבטחה",
    loading: "בטעינה…",
    retry: "ניסיון חוזר",
    unavailable: "המידע אינו זמין.",
    empty: "אין ארגון זמין לחשבון שלך.",
    name: "שם",
    email: "דוא״ל",
    role: "תפקיד",
    members: "חברים",
    save: "שמירה",
    saved: "נשמר.",
    cancel: "ביטול",
    remove: "הסרה",
    confirm: "אישור ההסרה",
    create: "יצירת ארגון",
    slug: "מזהה",
    description: "תיאור",
    website: "אתר",
    invite: "הזמנה",
    edit: "עריכת הפרטים שלי",
    password: "שינוי סיסמה",
    otp: "הגדרת מאמת",
    logout: "יציאה",
    noRoles: "לא הוקצה תפקיד.",
    resources: "משאבים",
    actions: "פעולות",
    noMembers: "עדיין אין חברים.",
    details: "פרטי הארגון",
    readOnly: "יש לך גישה לקריאה בלבד לארגון זה.",
  },
} satisfies Record<
  "es" | "de" | "it" | "pt-BR" | "ar" | "he",
  Record<
    | "profile"
    | "organizations"
    | "access"
    | "security"
    | "loading"
    | "retry"
    | "unavailable"
    | "empty"
    | "name"
    | "email"
    | "role"
    | "members"
    | "save"
    | "saved"
    | "cancel"
    | "remove"
    | "confirm"
    | "create"
    | "slug"
    | "description"
    | "website"
    | "invite"
    | "edit"
    | "password"
    | "otp"
    | "logout"
    | "noRoles"
    | "resources"
    | "actions"
    | "noMembers"
    | "details"
    | "readOnly",
    string
  >
>;
