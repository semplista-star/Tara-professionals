export const MOTIVATIONAL_QUOTES = [
  "Hoy, una conversación vale más que cien tareas hechas.",
  "Recuerda por qué empezasteis: de la pantalla a la vida.",
  "Un paso pequeño hoy es progreso real.",
  "Cuidaos entre vosotros tanto como cuidáis a Tara.",
  "El mejor código nace de un equipo que se siente escuchado.",
  "Hoy, pregúntale a alguien: ¿cómo estás de verdad?",
  "Sois 5 construyendo algo que importa.",
  "Descansa si hace falta. Tara también aprende a hacerlo.",
  "Cada piloto que hacéis es una puerta que se abre para alguien.",
  "La calma de hoy es la claridad de mañana.",
  "Escuchar bien es la mejor línea de código que escribiréis.",
  "Un mensaje sincero vale más que diez perfectos.",
  "Sois el puente, no el destino. Recordadlo hoy.",
  "Pequeños progresos, gran impacto a largo plazo.",
  "Hoy, celebra algo pequeño del equipo.",
  "El proyecto crece cuando vosotros también lo hacéis.",
  "Respira. Después, vuelve al trabajo con calma.",
  "Cada adolescente que ayudáis empieza con vosotros cinco.",
  "El trabajo de hoy vale la pena, aunque no se vea.",
  "Gracias por seguir creyendo en esto, hoy también.",
  "Lo que construís hoy, alguien lo va a necesitar mañana.",
  "Un equipo que se escucha, no se rompe fácil.",
  "Hoy también puedes empezar de cero si hace falta.",
  "La paciencia de hoy es el pilar de mañana.",
  "No todo tiene que estar perfecto para ser valioso.",
  "Cinco personas, un mismo propósito. Eso pesa.",
  "Pregúntate qué necesitas tú hoy, no solo Tara.",
  "El progreso silencioso también cuenta.",
  "Hoy, agradece algo que hizo un compañero.",
  "Equivocarse hoy es aprender para el pilotaje real.",
  "La empatía también se programa, línea a línea.",
  "No estás solo construyendo esto. Sois cinco.",
  "Hoy, sé la persona que te gustaría tener cerca.",
  "Un buen día empieza reconociendo cómo te sientes.",
  "Lo importante avanza aunque sea despacio.",
  "Cuidar el proyecto empieza por cuidaros vosotros.",
  "Hoy puedes pedir ayuda sin que sea debilidad.",
  "Cada línea de código lleva un poco de vosotros.",
  "La confianza del equipo se construye en días como hoy.",
  "Gracias por sostener esto, incluso en los días difíciles."
];

export function todaysQuote(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  const dayOfYear = Math.floor(diff / 86400000);
  return MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];
}
