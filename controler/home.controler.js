const db = require("../modules/db");
const JOI = require("joi");

function getHomePage(req, res, next) {
    if(req.session.status == "ADMIN") {
        return res.render("admin")
    }

    const queryGetUser = "SELECT * FROM users WHERE id_user = ?"
    db.query(queryGetUser, [req.session.userId], (err, userResult) => {
        if(err) {
            console.error(err)
            return res.render("/error")
        }

        const user = userResult[0]

        const name = user.name;

        const welcomePhrases = [
            "Bienvenue, {name} ! Prêt(e) à relever de nouveaux défis ?",
            "Salut, {name} ! Prêt(e) à mettre tes connaissances à l'épreuve ?",
            "Bonjour, {name} ! Prêt(e) à affronter de nouvelles questions ?",
            "Coucou, {name} ! Prêt(e) à tester tes compétences ?",
            "Salut, {name} ! Prêt(e) à relever le défi ?",
            "Bonjour, {name} ! Prêt(e) à te challenger ?",
            "Coucou, {name} ! Prêt(e) à te surpasser ?",
            "Salut, {name} ! Prêt(e) à montrer de quoi tu es capable ?",
            "Bonjour, {name} ! Prêt(e) à briller ?",
            "Coucou, {name} ! Prêt(e) à exceller ?",
            "Salut, {name} ! Prêt(e) à te dépasser ?",
            "Bonjour, {name} ! Prêt(e) à te surpasser ?",
            "Coucou, {name} ! Prêt(e) à te mettre au défi ?",
            "Salut, {name} ! Prêt(e) à tester tes connaissances ?",
            "Bonjour, {name} ! Prêt(e) à relever le défi ?",
            "Coucou, {name} ! Prêt(e) à te challenger ?",
            "Salut, {name} ! Prêt(e) à te surpasser ?",
        ];

        const motivationalPhrases = [
            "Chaque heure de préparation te rapproche un peu plus de ton objectif. Continue à avancer avec détermination, {name} !",
            "Tu as déjà franchi tant d'obstacles pour arriver là où tu es. Ce concours n'est qu'une étape de plus vers ta réussite. Tu as tout ce qu'il faut pour y arriver, {name} !",
            "Les défis que tu rencontres aujourd'hui te préparent pour les succès de demain. Reste concentré(e), {name}, et crois en tes capacités !",
            "N'oublie jamais à quel point tu es fort(e) et capable. Tu as le pouvoir de réaliser tes rêves, {name}. Continue à travailler avec passion et persévérance !",
            "Chaque question que tu révises te rend plus fort(e) et plus confiant(e). Tu es sur la bonne voie, {name} ! Continue à te battre pour ce en quoi tu crois.",
            "Les moments de doute ne sont que temporaires, mais la fierté de réussir sera éternelle. Ne laisse rien ni personne te détourner de ton chemin, {name} !",
            "Visualise ton succès et laisse cette vision te guider à travers les moments difficiles. Tu es destiné(e) à briller, {name}, alors ne laisse rien t'arrêter !",
            "Rappelle-toi que chaque petit progrès compte. Chaque effort que tu mets te rapproche un peu plus de la victoire. Continue à avancer, {name}, tu es sur la bonne voie !",
            "Chaque chapitre révisé est une brique ajoutée à ta fondation de connaissances. Avance pas à pas, {name}, et bientôt tu auras construit un édifice solide de compétences.",
            "Imagine la satisfaction que tu ressentiras lorsque tu répondras correctement à une question difficile grâce à ta préparation intensive. Tout ton travail acharné en vaudra la peine, {name} !",
            "Rappelle-toi que chaque formule que tu mémorises, chaque mécanisme d'action que tu comprends, te rapproche de ton objectif de devenir pharmacien(ne). Tu es en train de te forger un chemin vers le succès, {name} !",
            "Visualise-toi en train de franchir la ligne d'arrivée avec confiance le jour du concours. Tout ce temps et ces efforts que tu investis maintenant te rapprochent de cette réalité, {name} !",
            "Lorsque tu te sens dépassé(e) par la quantité de matière à étudier, rappelle-toi que chaque minute de révision te donne un avantage supplémentaire sur la concurrence. Tu es en train de te préparer à surpasser tes limites, {name} !",
            "Imagine le sentiment de fierté et d'accomplissement lorsque tu verras ton nom parmi les réussites du concours. Continue à travailler dur, {name}, car cette réalité est à ta portée !",
            "Chaque exercice résolu, chaque concept maîtrisé te rend plus fort(e) et plus confiant(e). Tu es en train de te transformer en un(e) expert(e) en pharmacie, prêt(e) à affronter tous les défis qui se présenteront à toi, {name} !",
            "Rappele-toi que chaque jour de révision te donne un avantage supplémentaire sur la compétition. Continue à t'investir pleinement dans ta préparation, {name}, car chaque petit pas te rapproche de la victoire finale !",
            "Rappelle-toi que même les médicaments ont besoin de temps pour agir. Ta réussite prendra peut-être un peu de temps, mais elle sera sûrement efficace, {name} !",
            "La préparation au concours d'internat de pharmacie, c'est comme une recette compliquée : il faut juste suivre les étapes, ajouter une bonne dose de détermination et éviter de paniquer en cas de surdosage de stress !",
            "Si jamais tu te sens dépassé(e), rappelle-toi qu'il n'y a pas de contre-indication à prendre une pause pour rire un peu. Garde le sourire, {name}, et tout ira bien !",
            "Imagine-toi en train de remettre ton diplôme de pharmacie avec une étiquette '100% Naturel, Sans Effets Secondaires'. Ça vaut bien quelques heures de révision, non ?",
            "Certains disent que la préparation au concours d'internat de pharmacie est comme une pilule difficile à avaler, mais toi, {name}, tu vas la transformer en bonbon grâce à ta détermination et ton sens de l'humour !",
            "Les erreurs de révision sont comme les effets secondaires d'un médicament : désagréables sur le moment, mais ils t'aident à mieux comprendre et à éviter de les refaire. Alors, prends chaque erreur comme une leçon, {name} !",
            "Si jamais tu te sens découragé(e), rappelle-toi que même les plus grands pharmaciens ont dû réviser pour arriver là où ils sont. Et puis, qui sait, peut-être qu'un jour on parlera de toi dans les manuels d'histoire de la pharmacie !",
            "Garde en tête que derrière chaque grand pharmacien(ne), il y a des tonnes de manuels, de notes et de café. Alors, prends une gorgée de caféine, {name}, et continue à te préparer comme un(e) champion(ne) !",
            "Rappelle-toi que même Batman aurait eu besoin de réviser pour devenir le pharmacien le plus cool de Gotham City. Tu es sur le point de devenir ton propre super-héros pharmaceutique, {name} !",
            "La préparation au concours d'internat de pharmacie, c'est comme assembler un puzzle géant où chaque pièce est une molécule. Et devine quoi ? Tu es en train de devenir le maître du puzzle, {name} !",
            "Imagine-toi en train de répondre aux questions du concours avec autant d'assurance que si tu prescrivais des bonbons contre la toux. Tu es sur la bonne voie pour devenir le pharmacien le plus cool du quartier, {name} !",
            "N'oublie pas que même les molécules les plus complexes ont été une fois des énigmes à résoudre. Tu es en train de devenir un(e) expert(e) en décryptage moléculaire, {name} !",
            "Rappelle-toi que même les médicaments ont des dates d'expiration, mais tes connaissances en pharmacie seront toujours fraîches et utiles. Continue à réviser, {name}, et deviens une version améliorée de toi-même !",
            "La préparation au concours d'internat de pharmacie, c'est un peu comme une potion magique : tu mélanges des ingrédients (tes connaissances), tu agites (les révisions) et tu obtiens un résultat magistral (la réussite) !",
            "Garde en tête que même les meilleures séries ont des épisodes un peu moins palpitants. Considère les moments de révision ennuyeux comme les épisodes de transition vers la saison de la réussite, {name} !",
            "Rappelle-toi que même les pharmacies les plus célèbres ont commencé par une simple idée. Tu es en train de construire ta propre marque pharmaceutique, {name}, et le succès n'est qu'une ordonnance loin !",
            "Tu es sur le point d'écrire le prochain chapitre de ta vie professionnelle, {name}. Chaque minute de préparation est une opportunité de sculpter ton avenir selon tes ambitions les plus audacieuses.",
            "Rappelle-toi que chaque défi que tu rencontres sur le chemin de la préparation est une occasion de grandir et de devenir plus fort(e). Tu es en train de te forger pour devenir le pharmacien d'exception que tu as toujours aspiré à être.",
            "N'oublie pas que derrière chaque grande réussite, il y a des heures de travail acharné et de sacrifices. Tu es en train de te frayer un chemin vers ton succès avec chaque livre ouvert, chaque concept maîtrisé.",
            "Visualise-toi debout sur le podium de la réussite, la fierté et l'accomplissement rayonnant sur ton visage. Cette image devrait être ta motivation constante, {name}, alors bats-toi pour la réaliser !",
            "Rappelle-toi que les rêves ne se réalisent pas par magie, mais par la sueur, la détermination et le dévouement. Tu es en train de transformer tes rêves en réalité, {name}, donc ne lâche rien maintenant !",
            "La route vers la réussite peut parfois sembler sinueuse et pleine d'obstacles, mais chaque pas que tu fais te rapproche un peu plus de ton objectif. Reste résolu(e), reste concentré(e), et rien ne pourra t'arrêter.",
            "Garde en tête que chaque fois que tu te sens fatigué(e) ou découragé(e), tu es un pas plus près de la réussite. Les plus grands accomplissements naissent souvent des moments les plus difficiles. Continue à te battre, {name}, car tu es destiné(e) à briller !",
            "Tu as déjà franchi tant d'étapes pour en arriver là où tu es aujourd'hui. Ne doute jamais de tes capacités, ne doute jamais de ta valeur. Tu es prêt(e) à conquérir ce concours et à laisser ton empreinte dans le monde de la pharmacie.",
            "Rappelle-toi que chaque question que tu révises, chaque concept que tu assimiles, te rapproche un peu plus de ton objectif. Tu es en train de te préparer pour le succès, {name}, alors continue à avancer avec confiance et détermination !",
            "Les moments de doute et de découragement font partie du voyage, mais ils ne définissent pas ta destination. Tu es un(e) combattant(e), un(e) rêveur(euse), un(e) futur(e) pharmacien(ne) brillant(e). Ne laisse rien ni personne te faire douter de ton potentiel.",
            "Visualise-toi en train de réussir, en train de réaliser tes rêves les plus fous. Cette image devrait être ta boussole, ta motivation, ton feu intérieur. Tu es sur le point de devenir le pharmacien(ne) exceptionnel(le) que tu as toujours aspiré à être, {name}.",
            "Rappelle-toi que chaque petit pas que tu fais, chaque petit effort que tu fournis, te rapproche un peu plus de la victoire. Tu es en train de te préparer pour le succès, {name}, alors continue à avancer avec courage, détermination et passion !",
            "Garde en tête que chaque défi que tu relèves, chaque obstacle que tu surmontes, te rend plus fort(e) et plus résilient(e). Tu es en train de te forger pour devenir le pharmacien(ne) exceptionnel(le) que tu as toujours rêvé d'être. Ne laisse rien ni personne te détourner de ta voie, {name} !",
            "Rappelle-toi que chaque échec, chaque erreur, est une opportunité d'apprendre et de grandir. Tu es en train de te transformer en un(e) expert(e) en pharmacie, en un(e) professionnel(le) compétent(e) et passionné(e). Continue à avancer, {name}, car le succès t'attend au bout du chemin !",
        ];
        
        function getMotivationalPhrase(name) {
            const randomIndex = Math.floor(Math.random() * motivationalPhrases.length);
            return motivationalPhrases[randomIndex].replace(/{name}/g, name);
        }

        function getWelcomePhrase(name) {
            const randomIndex = Math.floor(Math.random() * welcomePhrases.length);
            return welcomePhrases[randomIndex].replace(/{name}/g, name);
        }

        return res.render("home", { welcomePhrase: getWelcomePhrase(name), motivationalPhrase: getMotivationalPhrase(name) })
    })

}

module.exports = {
    getHomePage,
}