# GoBert Assistant — R8 Proof Transcript

## Q1: "Comment inscrire ma moto ?"
**Answer:**
Pour inscrire votre moto sur GoBert :
1. Identité : nom complet et téléphone (+237).
2. Véhicule : moto, marque, modèle, immatriculation (ex. EST 123 AB), année.
3. Documents : CNI, permis de conduire, carte grise (photos < 200 Ko).
4. Services : type, titres FR/EN, prix, zones.
5. Horaires : jours/heures ou 24h/24.
6. Vérification : relisez et soumettez → statut « en attente ».

Une fois approuvé, vous apparaissez sur la carte et recevez des courses.

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
