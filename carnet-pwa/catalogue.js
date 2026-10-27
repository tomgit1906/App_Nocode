// Liste de départ des plats et boissons proposés à la recherche.
// Chaque entrée : [nom français, description anglaise pour la reconnaissance photo].
// Les aliments ajoutés par le patient s'y ajoutent automatiquement.
window.CATALOGUE = (() => {
  const plats = [
    ["Steak-frites", "steak and french fries"], ["Steak haché", "a ground beef patty"], ["Poulet rôti", "roast chicken"],
    ["Poulet frites", "chicken with french fries"], ["Escalope de poulet", "a breaded chicken cutlet"], ["Rôti de porc", "roast pork slices"],
    ["Côte de porc", "a pork chop"], ["Pâtes bolognaise", "spaghetti bolognese"], ["Pâtes carbonara", "pasta carbonara"],
    ["Pâtes au pesto", "pasta with pesto"], ["Pâtes nature", "plain pasta"], ["Lasagnes", "lasagna"], ["Raviolis", "ravioli"],
    ["Pizza", "pizza"], ["Quiche lorraine", "quiche"], ["Croque-monsieur", "a croque monsieur toasted ham and cheese sandwich"],
    ["Sandwich jambon-beurre", "a baguette ham sandwich"], ["Sandwich poulet", "a chicken sandwich"], ["Burger", "a hamburger"],
    ["Burger frites", "a hamburger with french fries"], ["Kebab", "a kebab"], ["Tacos", "a french tacos wrap with fries"], ["Wrap", "a wrap"],
    ["Couscous", "couscous with vegetables and meat"], ["Tajine", "a tagine stew"], ["Paella", "paella"], ["Riz cantonais", "fried rice"],
    ["Riz", "plain white rice"], ["Sushis", "sushi"], ["Nems", "spring rolls"], ["Blanquette de veau", "veal stew in white sauce"],
    ["Bœuf bourguignon", "beef bourguignon stew"], ["Pot-au-feu", "pot-au-feu boiled beef with vegetables"],
    ["Hachis parmentier", "shepherd's pie"], ["Gratin dauphinois", "potato gratin"], ["Raclette", "raclette melted cheese with potatoes"],
    ["Tartiflette", "tartiflette"], ["Choucroute", "sauerkraut with sausages"], ["Cassoulet", "cassoulet bean stew"],
    ["Ratatouille", "ratatouille"], ["Chili con carne", "chili con carne"], ["Poisson pané", "breaded fish fingers"],
    ["Saumon et riz", "salmon with rice"], ["Poisson et légumes", "fish with vegetables"], ["Moules-frites", "mussels with french fries"],
    ["Omelette", "an omelette"], ["Œufs au plat", "fried eggs"], ["Salade composée", "a mixed salad"], ["Salade niçoise", "a nicoise salad"],
    ["Salade de pâtes", "a pasta salad"], ["Taboulé", "tabbouleh"], ["Soupe de légumes", "vegetable soup"],
    ["Purée jambon", "mashed potatoes with ham"], ["Frites", "french fries"], ["Pommes de terre vapeur", "boiled potatoes"],
    ["Lentilles", "lentils"], ["Légumes verts", "green vegetables"], ["Galette complète", "a buckwheat crepe with ham, cheese and egg"],
    ["Fromage", "cheese"], ["Tartines beurre confiture", "bread with butter and jam"], ["Tartines", "slices of bread"],
    ["Croissant", "a croissant"], ["Pain au chocolat", "a pain au chocolat pastry"], ["Brioche", "brioche bread"],
    ["Céréales au lait", "a bowl of cereal with milk"], ["Biscottes", "rusks"], ["Pain", "bread"], ["Yaourt nature", "plain yogurt"],
    ["Yaourt aux fruits", "fruit yogurt"], ["Fromage blanc", "fromage blanc"], ["Compote", "apple sauce"], ["Pomme", "an apple"],
    ["Banane", "a banana"], ["Orange", "an orange"], ["Fruits rouges", "berries"], ["Raisin", "grapes"], ["Barre de céréales", "a cereal bar"],
    ["Biscuits", "cookies"], ["Gâteau au chocolat", "chocolate cake"], ["Tarte aux pommes", "apple tart"], ["Crêpe sucrée", "a sweet crepe"],
    ["Gaufre", "a waffle"], ["Glace", "ice cream"], ["Mousse au chocolat", "chocolate mousse"], ["Crème dessert", "a pudding cup"],
    ["Éclair", "a chocolate eclair"], ["Chocolat", "a chocolate bar"], ["Bonbons", "candies"], ["Chips", "potato chips"],
    ["Cacahuètes", "peanuts"],
  ];
  const boissons = [
    ["Eau", "a glass of water"], ["Eau gazeuse", "sparkling water"], ["Café", "a cup of coffee"], ["Café sucré", "coffee with sugar"],
    ["Thé", "a cup of tea"], ["Thé sucré", "tea with sugar"], ["Chocolat chaud", "hot chocolate"], ["Lait", "a glass of milk"],
    ["Café au lait", "coffee with milk"], ["Jus d'orange", "orange juice"], ["Jus de pomme", "apple juice"],
    ["Jus multifruits", "multifruit juice"], ["Smoothie", "a smoothie"], ["Coca-Cola", "a can of Coca-Cola"],
    ["Coca-Cola zéro", "a can of Coca-Cola Zero"], ["Pepsi", "a can of Pepsi"], ["Pepsi max", "a can of Pepsi Max"],
    ["Orangina", "a bottle of Orangina"], ["Ice Tea", "a can of iced tea"], ["Limonade", "lemonade"], ["Sprite", "a can of Sprite"],
    ["Fanta", "a can of Fanta"], ["Sirop à l'eau", "a glass of fruit syrup drink"], ["Boisson énergisante", "an energy drink can"],
    ["Bière", "a glass of beer"], ["Bière sans alcool", "a bottle of alcohol-free beer"], ["Vin rouge", "a glass of red wine"],
    ["Vin blanc", "a glass of white wine"], ["Vin rosé", "a glass of rosé wine"], ["Champagne", "a glass of champagne"],
    ["Cidre", "a glass of cider"], ["Pastis", "a glass of pastis"], ["Cocktail", "a cocktail"],
  ];
  return [
    ...plats.map(([name, en]) => ({ name, en, cat: "plat" })),
    ...boissons.map(([name, en]) => ({ name, en, cat: "boisson" })),
  ];
})();

// Proposés d'un geste tant que le patient n'a pas encore ses propres habitudes.
window.SUGGESTIONS = ["Steak-frites", "Pâtes bolognaise", "Pizza", "Salade composée", "Tartines beurre confiture", "Yaourt nature",
  "Pomme", "Eau", "Café", "Coca-Cola", "Jus d'orange"];

window.TAILLES = ["Verre", "Tasse", "Canette 33 cl", "Bouteille 50 cl", "Grand format"];
