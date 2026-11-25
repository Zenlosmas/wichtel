-- Einmalige Datenkorrektur, kein Schema-Change.
--
-- Carlo wollte den Titel der Familienrunde schlichter: "Heiligabend bei Oma"
-- -> "Weihnachten". Der Titel steht nur in der Runde selbst, der Link bleibt
-- unveraendert (die Runden-ID ist der Schluessel, nicht der Titel).
--
-- Bewusst hart auf diese eine Runde begrenzt: kein Massen-Update, das spaeter
-- versehentlich andere Runden umbenennt.

update public.wichtel_rounds
   set title = 'Weihnachten'
 where id = '2Wz1U-m2TTxSYw70'
   and title = 'Heiligabend bei Oma';
