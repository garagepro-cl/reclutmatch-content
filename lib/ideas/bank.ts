import type { Idea } from "./types";

/**
 * Banco de ideas incorporado, por slug de negocio.
 * Se usa cuando no hay ANTHROPIC_API_KEY o si la IA falla.
 * Español de Chile, enfocado en selección y evaluación psicométrica.
 */
export const IDEA_BANK: Record<string, Idea[]> = {
  reclutmatch: [
    {
      pillar: "errores de contratación y su costo",
      type: "CAROUSEL",
      title: "Lo que cuesta de verdad contratar mal",
      hook: "No es solo el sueldo: es todo lo que arrastra",
      slides: [
        {
          title: "El número que nadie calcula",
          body: "Una mala contratación cuesta entre 6 y 12 sueldos: reclutar de nuevo, capacitar de nuevo y todo lo que dejó de producirse.",
          layout: "split",
          imagePrompt: "worried business owner reviewing financial documents at desk in dark modern office, cinematic moody light",
        },
        {
          title: "Los costos invisibles",
          layout: "list",
          body: "",
          bullets: [
            "Clientes mal atendidos que no vuelven",
            "Equipo sobrecargado cubriendo el puesto",
            "Jefaturas apagando incendios",
            "Volver a empezar el proceso desde cero",
          ],
        },
        {
          title: "¿Por qué pasa?",
          body: "Porque la mayoría de las contrataciones se deciden con la impresión de una entrevista de 45 minutos.",
          layout: "split",
          imagePrompt: "job interview seen through glass wall of modern dark office meeting room, two people talking, cinematic",
        },
        {
          title: "La entrevista sola predice poco",
          body: "Décadas de investigación lo muestran: la entrevista no estructurada es de los peores predictores de desempeño.",
          layout: "statement",
        },
        {
          title: "Evidencia antes de decidir",
          body: "Un test validado + entrevista estructurada multiplica la probabilidad de acertar. Eso es contratar con datos.",
          layout: "split",
          imagePrompt: "professional reviewing candidate assessment report on laptop in dark modern office, violet ambient light",
        },
      ],
      caption:
        "Una mala contratación no cuesta un sueldo: cuesta entre 6 y 12. 📉\n\nY casi siempre se decide en una entrevista de 45 minutos.\n\nEvalúa con datos antes de firmar.\n\n👉 reclutmatch.cl",
      hashtags: [
        "#reclutamiento", "#seleccion", "#rrhh", "#rrhhchile",
        "#pymechile", "#contratacion", "#talentohumano", "#reclutmatch",
      ],
    },
    {
      pillar: "educación en selección (tests, Big Five, entrevistas)",
      type: "CAROUSEL",
      title: "Qué mide de verdad un test de personalidad",
      hook: "Big Five explicado sin academicismos",
      slides: [
        {
          title: "No es un horóscopo laboral",
          body: "Un test serio no te dice si alguien es 'bueno o malo': mide rasgos estables que predicen cómo trabaja.",
          layout: "split",
          imagePrompt: "person completing an online assessment on laptop in dark modern workspace, focused, cinematic light",
        },
        {
          title: "Los 5 grandes rasgos",
          layout: "list",
          body: "El modelo Big Five es el estándar científico:",
          bullets: [
            "Responsabilidad: orden y cumplimiento",
            "Estabilidad: manejo de la presión",
            "Extraversión: energía social",
            "Amabilidad: colaboración",
            "Apertura: adaptación al cambio",
          ],
        },
        {
          title: "El rasgo que más predice",
          body: "La responsabilidad (conscientiousness) es el mejor predictor general de desempeño laboral en casi todos los cargos.",
          layout: "statement",
        },
        {
          title: "Test malo vs test serio",
          layout: "compare",
          body: "",
          compareLeftLabel: "Test de revista",
          compareLeft: ["Etiquetas simplistas", "Sin base científica", "Resultados que no predicen nada"],
          compareRightLabel: "Test validado",
          compareRight: ["120 ítems calibrados", "Modelo Big Five", "Encaje medido contra el cargo real"],
        },
        {
          title: "La clave: contra qué comparas",
          body: "El resultado vale cuando se compara con el perfil del cargo. Vendedor y contador no necesitan lo mismo.",
          layout: "split",
          imagePrompt: "manager comparing two candidate profiles side by side on screen in dark office, violet glow",
        },
      ],
      caption:
        "¿Test de personalidad = horóscopo laboral? Solo los malos. 🧠\n\nEl modelo Big Five es el estándar científico para predecir desempeño, y funciona cuando se compara contra el perfil real del cargo.\n\n👉 Conoce cómo lo hacemos en reclutmatch.cl",
      hashtags: [
        "#bigfive", "#psicometria", "#seleccion", "#rrhh",
        "#reclutamiento", "#rrhhchile", "#evaluacion", "#reclutmatch",
      ],
    },
    {
      pillar: "fit empresarial (el match candidato-empresa)",
      type: "CAROUSEL",
      title: "El candidato perfecto que fue un desastre",
      hook: "Currículum impecable no es sinónimo de encaje",
      slides: [
        {
          title: "La historia se repite",
          body: "Gran CV, buenas referencias, entrevista brillante. A los 4 meses, renuncia o hay que pedírsela. ¿Te suena?",
          layout: "split",
          imagePrompt: "empty desk with a box of belongings in modern dark office, moody cinematic light, resignation concept",
        },
        {
          title: "El problema no era la persona",
          body: "Era el encaje: un excelente profesional en el cargo equivocado rinde menos que uno promedio en el cargo correcto.",
          layout: "statement",
        },
        {
          title: "Qué es el fit real",
          layout: "list",
          body: "El match se mide en tres capas:",
          bullets: [
            "Persona y cargo: rasgos vs exigencias",
            "Persona y equipo: cómo colabora",
            "Persona y empresa: ritmo y cultura",
          ],
        },
        {
          title: "CV vs encaje",
          layout: "compare",
          body: "",
          compareLeftLabel: "Solo CV",
          compareLeft: ["Dice qué hizo", "No dice cómo trabaja", "Se maquilla fácil"],
          compareRightLabel: "CV + evaluación",
          compareRight: ["Muestra cómo es", "Predice cómo rendirá", "Se compara con el cargo"],
        },
        {
          title: "Medirlo antes de contratar",
          body: "ReclutMatch compara al candidato contra 35 perfiles de cargo calibrados y te muestra el ranking de encaje.",
          layout: "split",
          imagePrompt: "clean data dashboard glowing on screen in dark office, person analyzing ranking, violet ambient light",
        },
      ],
      caption:
        "El mejor CV de la pila puede ser tu peor contratación. 🎯\n\nLo que predice el éxito no es el currículum: es el encaje entre la persona y el cargo.\n\nMídelo antes de firmar.\n\n👉 reclutmatch.cl",
      hashtags: [
        "#fitlaboral", "#seleccion", "#reclutamiento", "#rrhh",
        "#rrhhchile", "#pyme", "#contratacion", "#reclutmatch",
      ],
    },
    {
      pillar: "producto ReclutMatch (informe, perfiles de cargo)",
      type: "CAROUSEL",
      title: "Así se ve contratar con evidencia",
      hook: "Del test al informe en el mismo día",
      slides: [
        {
          title: "1. El candidato responde online",
          body: "120 preguntas, 20 minutos, desde cualquier dispositivo. Con consentimiento informado y datos protegidos (Ley 21.719).",
          layout: "split",
          imagePrompt: "candidate answering questionnaire on smartphone in modern space, dark tones, cinematic",
        },
        {
          title: "2. Validez del resultado",
          body: "El sistema detecta respuestas al azar o infladas antes de que llegues a leer el informe.",
          layout: "split",
          imagePrompt: "abstract data verification concept, glowing checkmarks over dark interface, violet light",
        },
        {
          title: "3. Informe profesional",
          layout: "list",
          body: "Lo que recibes:",
          bullets: [
            "Perfil Big Five del candidato",
            "Fortalezas y puntos de atención",
            "Ranking de encaje con 35 cargos",
            "PDF listo para compartir",
          ],
        },
        {
          title: "Decisión con respaldo",
          body: "No reemplaza tu criterio: lo alimenta. Entrevistas mejor cuando sabes qué preguntar.",
          layout: "statement",
        },
      ],
      caption:
        "¿Cómo se ve contratar con datos? Así: test online de 20 minutos → informe profesional el mismo día, con ranking de encaje contra 35 perfiles de cargo. 📊\n\n👉 Pide una demo en reclutmatch.cl",
      hashtags: [
        "#reclutmatch", "#seleccion", "#rrhh", "#psicometria",
        "#reclutamiento", "#rrhhchile", "#pymechile", "#evaluacion",
      ],
    },
    {
      pillar: "tendencias RRHH Chile (Ley 21.719, mercado laboral)",
      type: "CAROUSEL",
      title: "Ley 21.719: lo que cambia al evaluar candidatos",
      hook: "Datos personales en selección, sin sustos",
      slides: [
        {
          title: "La nueva regla del juego",
          body: "Chile actualizó su ley de protección de datos. Evaluar candidatos sigue siendo legal — pero con reglas claras.",
          layout: "split",
          imagePrompt: "law book and laptop on desk in dark modern office, cinematic still life, moody light",
        },
        {
          title: "Lo esencial",
          layout: "list",
          body: "Para evaluar cumpliendo:",
          bullets: [
            "Consentimiento informado explícito",
            "Usar los datos solo para el proceso",
            "Acceso restringido a los informes",
            "Eliminar datos cuando corresponde",
          ],
        },
        {
          title: "El riesgo de improvisar",
          body: "Tests por WhatsApp, planillas con datos sensibles compartidas por correo: eso hoy es un riesgo legal real.",
          layout: "split",
          imagePrompt: "messy spreadsheets and sticky notes on screen in dark office, chaos concept, cinematic",
        },
        {
          title: "Cumplir no es opcional",
          body: "Un proceso de selección serio protege al candidato y a tu empresa al mismo tiempo.",
          layout: "statement",
        },
      ],
      caption:
        "¿Evalúas candidatos? La Ley 21.719 te aplica. ⚖️\n\nConsentimiento informado, uso limitado de los datos y acceso restringido ya no son 'buenas prácticas': son la regla.\n\nReclutMatch lo trae incorporado.\n\n👉 reclutmatch.cl",
      hashtags: [
        "#ley21719", "#datospersonales", "#rrhh", "#rrhhchile",
        "#compliance", "#seleccion", "#reclutamiento", "#reclutmatch",
      ],
    },
    {
      pillar: "errores de contratación y su costo",
      type: "CAROUSEL",
      title: "5 señales de alerta en una entrevista",
      hook: "Lo que el CV no te va a contar",
      slides: [
        {
          title: "Culpa a todos menos a sí mismo",
          body: "Si cada salida anterior fue 'culpa del jefe' o 'del equipo', el patrón probablemente viaja con la persona.",
          layout: "split",
          imagePrompt: "tense job interview moment, candidate gesturing defensively, dark modern meeting room, cinematic",
        },
        {
          title: "Respuestas sin ejemplos",
          body: "'Soy muy ordenado' no es evidencia. Pide la situación concreta: qué hizo, cómo y qué resultó.",
          layout: "split",
          imagePrompt: "interviewer taking notes while listening, shallow depth of field, dark office, moody light",
        },
        {
          title: "Las otras tres",
          layout: "list",
          body: "",
          bullets: [
            "Fechas que no cuadran entre CV y relato",
            "Interés solo en sueldo y horario",
            "Cero preguntas sobre el cargo",
          ],
        },
        {
          title: "La entrevista no basta",
          body: "Estas señales filtran, pero no predicen desempeño. Para eso está la evaluación objetiva.",
          layout: "statement",
        },
      ],
      caption:
        "Hay cosas que el CV no te va a contar. 🚩\n\n5 señales de alerta para tu próxima entrevista — y por qué ninguna reemplaza evaluar con datos.\n\n👉 reclutmatch.cl",
      hashtags: [
        "#entrevistalaboral", "#seleccion", "#reclutamiento", "#rrhh",
        "#rrhhchile", "#pyme", "#talentohumano", "#reclutmatch",
      ],
    },
  ],
};
