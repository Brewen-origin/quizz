import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const questions = [

  //  QCM (5) 

  {
    type: 'qcm',
    question: 'Quelle est la capitale de l\'Australie ?',
    choices: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    answer: 2,
    difficulty: 2,
    theme: 'culture',
    image: null,
  },
  {
    type: 'qcm',
    question: 'Combien de joueurs composent une équipe de rugby à XV sur le terrain ?',
    choices: ['13', '14', '15', '16'],
    answer: 2,
    difficulty: 1,
    theme: 'sport',
    image: null,
  },
  {
    type: 'qcm',
    question: 'Qui a peint la Joconde ?',
    choices: ['Michel-Ange', 'Raphaël', 'Léonard de Vinci', 'Botticelli'],
    answer: 2,
    difficulty: 1,
    theme: 'culture',
    image: null,
  },
  {
    type: 'qcm',
    question: 'En quelle année a eu lieu la Révolution française ?',
    choices: ['1776', '1789', '1799', '1804'],
    answer: 1,
    difficulty: 1,
    theme: 'histoire',
    image: null,
  },
  {
    type: 'qcm',
    question: 'Quel est le symbole chimique de l\'or ?',
    choices: ['Or', 'Go', 'Au', 'Ag'],
    answer: 2,
    difficulty: 2,
    theme: 'science',
    image: null,
  },

  //  VRAI / FAUX (5) 

  {
    type: 'true_false',
    question: 'La Grande Muraille de Chine est visible à l\'œil nu depuis l\'espace.',
    choices: ['Vrai', 'Faux'],
    answer: 1,
    difficulty: 2,
    theme: 'culture',
    image: null,
  },
  {
    type: 'true_false',
    question: 'Le mont Everest est le point le plus haut de la Terre mesuré depuis le centre de la Terre.',
    choices: ['Vrai', 'Faux'],
    answer: 1,
    difficulty: 3,
    theme: 'science',
    image: null,
  },
  {
    type: 'true_false',
    question: 'Napoléon Bonaparte est né en France.',
    choices: ['Vrai', 'Faux'],
    answer: 1,
    difficulty: 2,
    theme: 'histoire',
    image: null,
  },
  {
    type: 'true_false',
    question: 'Le football a été inventé en Angleterre.',
    choices: ['Vrai', 'Faux'],
    answer: 0,
    difficulty: 1,
    theme: 'sport',
    image: null,
  },
  {
    type: 'true_false',
    question: 'Les dauphins sont des poissons.',
    choices: ['Vrai', 'Faux'],
    answer: 1,
    difficulty: 1,
    theme: 'science',
    image: null,
  },

  //  ESTIMATION (5) 
  // answer = valeur numérique exacte (tolérance ±10% dans la game logic)

  {
    type: 'estimation',
    question: 'En quelle année a été fondée la ville de Paris ?',
    choices: [],
    answer: 250,
    difficulty: 3,
    theme: 'histoire',
    image: null,
  },
  {
    type: 'estimation',
    question: 'Combien de kilomètres mesure le Tour de France en moyenne ?',
    choices: [],
    answer: 3400,
    difficulty: 2,
    theme: 'sport',
    image: null,
  },
  {
    type: 'estimation',
    question: 'À quelle température (en °C) l\'eau bout-elle au sommet de l\'Everest ?',
    choices: [],
    answer: 70,
    difficulty: 3,
    theme: 'science',
    image: null,
  },
  {
    type: 'estimation',
    question: 'Combien y a-t-il de pays dans l\'Union Européenne en 2024 ?',
    choices: [],
    answer: 27,
    difficulty: 2,
    theme: 'culture',
    image: null,
  },
  {
    type: 'estimation',
    question: 'En quelle année a été inaugurée la Tour Eiffel ?',
    choices: [],
    answer: 1889,
    difficulty: 1,
    theme: 'histoire',
    image: null,
  },

  //  RÉPONSE LIBRE (5) 
  // answer = chaîne normalisée (lowercase, sans accents dans la game logic)

  {
    type: 'free_text',
    question: 'Quel est le pays le plus grand du monde en superficie ?',
    choices: [],
    answer: 'russie',
    difficulty: 1,
    theme: 'culture',
    image: null,
  },
  {
    type: 'free_text',
    question: 'Quel scientifique a développé la théorie de la relativité générale ?',
    choices: [],
    answer: 'einstein',
    difficulty: 1,
    theme: 'science',
    image: null,
  },
  {
    type: 'free_text',
    question: 'Dans quel sport remporte-t-on la Coupe Davis ?',
    choices: [],
    answer: 'tennis',
    difficulty: 2,
    theme: 'sport',
    image: null,
  },
  {
    type: 'free_text',
    question: 'Comment s\'appelait le premier homme à avoir marché sur la Lune ?',
    choices: [],
    answer: 'armstrong',
    difficulty: 1,
    theme: 'histoire',
    image: null,
  },
  {
    type: 'free_text',
    question: 'Quelle est la formule chimique de l\'eau ?',
    choices: [],
    answer: 'h2o',
    difficulty: 1,
    theme: 'science',
    image: null,
  },
]

async function seed() {
  console.log(`Insertion de ${questions.length} questions...`)

  const { data, error } = await supabase
    .from('questions')
    .insert(questions)
    .select()

  if (error) {
    console.error('Erreur lors du seed :', error.message)
    process.exit(1)
  }

  console.log(`✅ ${data.length} questions insérées avec succès.`)
}

seed()