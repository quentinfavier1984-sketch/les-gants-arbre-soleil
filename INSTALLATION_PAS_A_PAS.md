# Les Gants — version à licences manuelles (sans Stripe)

Le paiement est vérifié par l’administrateur, hors du site. L’administrateur crée ensuite les licences et envoie les codes par e-mail. Aucun paiement, aucune intégration Stripe, aucun envoi automatique.

## Installation GitHub Desktop et Netlify

1. Extraire cette archive dans un dossier. Le dossier racine contient `package.json`, `netlify.toml`, `public/` et `netlify/functions/`.
2. Dans GitHub Desktop : File > Add local repository > Choose ce dossier > Create repository here. Puis Publish repository (privé conseillé).
3. Dans Netlify : Add new project > Import an existing project > GitHub > choisir ce nouveau dépôt. Branche `main`, publish directory `public`, functions directory `netlify/functions` (ou laisser Netlify lire `netlify.toml`). Déployer.
4. Dans Netlify > Project configuration > Environment variables, créer deux secrets différents : `ADMIN_MASTER_KEY` et `LICENCE_SIGNING_SECRET`. Utiliser des valeurs aléatoires longues (32 octets au moins). Ne pas les placer sur GitHub ni les envoyer par message.
5. Redéployer le site. Ouvrir `https://VOTRE-SITE.netlify.app/api/health` : `admin` et `licences` doivent être `true`.
6. Dans le site, ouvrir Administration, entrer la clé admin et charger les licences. Créer une licence avec nom, e-mail facultatif et durée en jours. La clé complète n’apparaît qu’à la création : la copier et la transmettre vous-même à la participante.
7. Tester l’activation, la révocation, la réactivation et la prolongation. Vérifier que les données du parcours peuvent être exportées en JSON.

## Important

- Aucune vente automatisée et aucun abonnement bancaire. Renouvellement par prolongation manuelle dans l’administration après vérification du paiement.
- Les licences sont stockées dans Netlify Blobs, sur le site Netlify associé. Conserver le secret de signature pour éviter d’invalider les clés.
- Les informations de parcours restent localement dans le navigateur ; proposer aux participantes l’export JSON.
- Avant ouverture commerciale, vérifier conditions de vente, protection des données et fonctionnement des licences.
