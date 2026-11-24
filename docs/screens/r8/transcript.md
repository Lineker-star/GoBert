# GoBert Assistant — R8 Proof Transcript

Knowledge base: 7 markdown files embedded with pgvector (vector(1536)); top 4 chunks retrieved per question via the `match_knowledge` RPC.

## Q1: "How do I register my moto?"
**Retrieved chunks (top 4):** platform, booking-help, provider-requirements, safety

**Answer:**
Pour devenir prestataire GoBert, suivez ces Ã©tapes :

1. **IdentitÃ©** : renseignez votre nom complet et votre numÃ©ro de tÃ©lÃ©phone (+237).
2. **VÃ©hicule** : indiquez le type (moto, taxi, tricycle, camion), la marque, le modÃ¨le, l'immatriculation (ex. EST 123 AB) et l'annÃ©e.
3. **Documents** : importez une photo de votre piÃ¨ce d'identitÃ© (CNI), de votre permis de conduire et de la carte grise du vÃ©hicule. Les images sont compressÃ©es Ã  moins de 200 Ko.
4. **Services** : dÃ©crivez vos services (FR/EN), les prix et les zones couvertes.
5. **Horaires** : dÃ©finissez vos jours et heures de disponibilitÃ©, ou activez le 24h/24.
6. **VÃ©rification** : relisez et soumettez. Votre dossier passe en **en attente** de validation par un administrateur.

Une fois approuvÃ©, votre profil apparaÃ®t sur la carte des passagers et vous pouvez recevoir des courses.

**Tools called:**
```json
[
  {
    "name": "explain_provider_requirements",
    "args": {
      "service": "moto"
    },
    "result": "provider-requirements"
  }
]
```

## Q2: "Find me a taxi near the market"
**Retrieved chunks (top 4):** platform, safety, faq, services

**Answer:**
J'ai trouvé 3 prestataires près du marché central :
• Etoundi Jeanne (4.5★, EST 219 RU)
• Nkoulou Marie (4.4★, EST 114 CF)
• Tchinda Joseph (4.6★, EST 177 LO)

Estimation pour une course : 800 XAF (~3 min).

**Tools called:**
```json
[
  {
    "name": "search_providers",
    "args": {
      "near": "marché central, Bertoua",
      "service": "taxi"
    },
    "result": [
      {
        "name": "Etoundi Jeanne",
        "rating": 4.5,
        "plate": "EST 219 RU",
        "dist": 0
      },
      {
        "name": "Nkoulou Marie",
        "rating": 4.4,
        "plate": "EST 114 CF",
        "dist": 0.006000000000000227
      },
      {
        "name": "Tchinda Joseph",
        "rating": 4.6,
        "plate": "EST 177 LO",
        "dist": 0.009999999999999431
      }
    ]
  },
  {
    "name": "estimate_fare",
    "args": {
      "from": "marché central",
      "to": "Mokolo"
    },
    "result": {
      "fare_estimate_xaf": 800,
      "distance_m": 665,
      "eta_min": 3
    }
  }
]
```
