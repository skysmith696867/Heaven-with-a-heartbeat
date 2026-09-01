export type ChronicleQuestion = {
  id: number;
  collection: "Known Data" | "Inner Worlds";
  prompt: string;
};

// Sky approves every entry before it becomes Chronicle canon.
export const chronicleQuestions: ChronicleQuestion[] = [
  { id: 1, collection: "Known Data", prompt: "What five fictional characters remind you most of yourself?" },
  { id: 2, collection: "Known Data", prompt: "What are your top five shows or films?" },
  { id: 3, collection: "Known Data", prompt: "What are your top five favorite books?" },
  { id: 4, collection: "Inner Worlds", prompt: "If every alternate-universe version of you met in one room, which would you trust, envy, and fear?" },
  { id: 5, collection: "Inner Worlds", prompt: "If your mind were a city, what part is abandoned, what part is under construction, and what stays open all night?" },
  { id: 6, collection: "Inner Worlds", prompt: "Turn one emotion into a physical object. What does it look like, what can it do, and who is allowed to touch it?" },
  { id: 7, collection: "Inner Worlds", prompt: "Choose one contradiction in your personality. If each side became a character, what would they accuse each other of—and what are they both trying to protect?" },
  { id: 8, collection: "Inner Worlds", prompt: "Your memories become a museum. Which ordinary moment receives the grandest room, and which dramatic memory gets locked underground?" },
  { id: 9, collection: "Inner Worlds", prompt: "Someone must recognize you without seeing your face, hearing your voice, or knowing your name. What five clues would identify you?" },
  { id: 10, collection: "Inner Worlds", prompt: "Your deepest fear is allowed to write one law of the universe. What law does it create, and how would you rebel against it?" },
  { id: 11, collection: "Inner Worlds", prompt: "You meet your ten-year-old self somewhere impossible. What would they admire about you, misunderstand about you, and warn you about?" },
  { id: 12, collection: "Inner Worlds", prompt: "You may remove the painful side of one personality trait—but its gift disappears too. Which trait do you choose, and do you accept the trade?" },
  { id: 13, collection: "Inner Worlds", prompt: "Your life has contained a recurring symbol you never noticed. What do you hope it is, and what are you afraid it might be?" },
];

export const chronicleQuestionIds = new Set(chronicleQuestions.map((question) => question.id));
