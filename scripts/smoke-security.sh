#!/usr/bin/env bash
# Feindliche Prüfungen gegen das echte Backend.
# Frage: kann jemand in die Host-Ansicht, eine fremde Zuteilung sehen oder
# doppelt ziehen?
#
# Aufruf: ./scripts/smoke-security.sh
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
[ -f .env.local ] || { echo "FEHLT: .env.local"; exit 1; }
set -a; . ./.env.local; set +a

URL="${VITE_SUPABASE_URL:?VITE_SUPABASE_URL fehlt}"
KEY="${VITE_SUPABASE_ANON_KEY:?VITE_SUPABASE_ANON_KEY fehlt}"
API="$URL/rest/v1"

fail=0
ok()  { echo "  PASS  $1"; }
bad() { echo "  FAIL  $1"; fail=1; }

rpc() {
  curl -sS -X POST "$API/rpc/$1" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H 'Content-Type: application/json' -d "$2"
}

jget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

# Gerätegeheimnisse wie im Browser: 32 Zeichen.
DEV_A="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
DEV_B="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

echo "Backend: $URL"

echo "1) Tabellen direkt lesen (Gast ohne Token)"
for table in wichtel_rounds wichtel_participants; do
  body=$(curl -sS "$API/$table?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
  if echo "$body" | grep -qiE 'permission denied|not allowed|42P01|401|does not exist'; then
    ok "$table gesperrt"
  else
    bad "$table liefert Daten: $(echo "$body" | head -c 120)"
  fi
done

echo "2) Interne Funktion wichtel_new_id (darf anon nicht aufrufen)"
body=$(rpc wichtel_new_id '{"p_len":16}')
if echo "$body" | grep -qiE 'permission denied|not allowed|401|does not exist|42P01'; then
  ok "kein Zugriff auf die ID-Erzeugung"
else
  bad "wichtel_new_id antwortet: $(echo "$body" | head -c 120)"
fi

echo "3) Testrunde anlegen"
created=$(rpc wichtel_create '{"p_title":"Security-Test","p_budget":"5 €","p_event_date":"2026-12-24","p_names":["Anna","Papa","Mama","Jonas"]}')
rid=$(echo "$created" | jget "['roundId']")
host=$(echo "$created" | jget "['hostToken']")
[ -n "$rid" ] && [ -n "$host" ] && ok "roundId=$rid" || { bad "Anlegen fehlgeschlagen: $created"; exit 1; }

echo "4) Verrät der Gast-Zustand Zuteilung oder Host-Token?"
state=$(rpc wichtel_state "{\"p_round_id\":\"$rid\"}")
echo "$state" | grep -qi 'assignment'    && bad "assignment im Gast-Zustand"    || ok "keine Zuteilung im Gast-Zustand"
echo "$state" | grep -qi 'host_token'    && bad "host_token im Gast-Zustand"    || ok "kein host_token im Gast-Zustand"
echo "$state" | grep -qi 'device_secret' && bad "device_secret im Gast-Zustand" || ok "kein device_secret im Gast-Zustand"
echo "$state" | grep -qi "$host"         && bad "Host-Token im Gast-Zustand"    || ok "Host-Token taucht nicht auf"

echo "5) Host-Ansicht ohne Token"
body=$(rpc wichtel_host_state "{\"p_host_token\":\"$rid\"}")
[ "$body" = "null" ] && ok "Runden-ID öffnet die Host-Ansicht nicht" || bad "Host-Ansicht über die Runden-ID: $(echo "$body" | head -c 80)"
body=$(rpc wichtel_host_state '{"p_host_token":"ZZZZZZZZZZZZZZZZ"}')
[ "$body" = "null" ] && ok "geratenes Token öffnet nichts" || bad "geratenes Token liefert: $(echo "$body" | head -c 80)"

echo "6) Zurücksetzen mit falschem Token"
body=$(rpc wichtel_reset "{\"p_host_token\":\"$rid\",\"p_name\":\"Anna\"}")
echo "$body" | grep -q '"ok": *false' && ok "falsches Token setzt nichts zurück" || bad "Reset ohne Token: $body"

echo "7) Ziehen ohne echtes Gerätegeheimnis"
body=$(rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"kurz\"}")
[ "$(echo "$body" | jget "['status']")" = "unknown" ] && ok "zu kurzes Geheimnis wird abgelehnt" || bad "kurzes Geheimnis: $body"

echo "8) Unbekannter Name"
body=$(rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Fremder\",\"p_device_secret\":\"$DEV_A\"}")
[ "$(echo "$body" | jget "['status']")" = "unknown" ] && ok "unbekannter Name zieht nichts" || bad "unbekannter Name: $body"

echo "9) Doppelklick: zwei gleichzeitige Anfragen desselben Geräts"
rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"$DEV_A\"}" > /tmp/sec-a.json &
rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"$DEV_A\"}" > /tmp/sec-b.json &
wait
a=$(jget "['assignment']" < /tmp/sec-a.json)
b=$(jget "['assignment']" < /tmp/sec-b.json)
[ -n "$a" ] && [ "$a" = "$b" ] && ok "beide Klicks liefern dieselbe Zuteilung ($a)" || bad "Doppelklick: a=$a b=$b"

state=$(rpc wichtel_state "{\"p_round_id\":\"$rid\"}")
taken=$(echo "$state" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for p in d['participants'] if p['taken']))")
drawn=$(echo "$state" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for p in d['participants'] if p['revealed']))")
[ "$taken" = "1" ] && [ "$drawn" = "1" ] && ok "genau ein Name vergeben, ein Zug verbraucht" || bad "nach Doppelklick: taken=$taken drawn=$drawn"

echo "10) Zwei Geräte gleichzeitig auf denselben Namen"
rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Papa\",\"p_device_secret\":\"$DEV_A\"}" > /tmp/sec-c.json &
rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Papa\",\"p_device_secret\":\"$DEV_B\"}" > /tmp/sec-d.json &
wait
sa=$(jget "['status']" < /tmp/sec-c.json)
sb=$(jget "['status']" < /tmp/sec-d.json)
if { [ "$sa" = "ok" ] && [ "$sb" = "already" ]; } || { [ "$sa" = "already" ] && [ "$sb" = "ok" ]; }; then
  ok "genau ein Gerät gewinnt (ok/already), egal in welcher Reihenfolge"
else
  bad "Wettlauf: c=$sa d=$sb"
fi
taken2=$(rpc wichtel_state "{\"p_round_id\":\"$rid\"}" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for p in d['participants'] if p['taken']))")
[ "$taken2" = "2" ] && ok "zwei Namen vergeben, kein Name doppelt" || bad "erwartet 2 vergeben, war $taken2"

echo "11) Sieht ein fremdes Gerät die Zuteilung?"
body=$(rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"$DEV_B\"}")
st=$(echo "$body" | jget "['status']")
[ "$st" = "already" ] && ok "fremdes Gerät bekommt nur 'already', keine Zuteilung" || bad "fremdes Gerät: $body"

echo "12) Host setzt zurück, Zuteilung bleibt dieselbe Person"
before=$(rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"$DEV_A\"}" | jget "['assignment']")
reset=$(rpc wichtel_reset "{\"p_host_token\":\"$host\",\"p_name\":\"Anna\"}")
[ "$(echo "$reset" | jget "['ok']")" = "True" ] && ok "Reset mit echtem Token" || bad "Reset: $reset"

open_again=$(rpc wichtel_state "{\"p_round_id\":\"$rid\"}" | python3 -c "import sys,json;d=json.load(sys.stdin);print([p['revealed'] for p in d['participants'] if p['name']=='Anna'][0])")
[ "$open_again" = "False" ] && ok "Anna ist wieder offen" || bad "Anna nach Reset noch gezogen"

echo "13) Handywechsel: neues Gerät zieht, Zuteilung bleibt dieselbe Person"
body=$(rpc wichtel_draw "{\"p_round_id\":\"$rid\",\"p_name\":\"Anna\",\"p_device_secret\":\"$DEV_B\"}")
st=$(echo "$body" | jget "['status']")
asg=$(echo "$body" | jget "['assignment']")
[ "$st" = "ok" ] && ok "neues Gerät übernimmt den Zug" || bad "Handywechsel: $body"
[ -n "$before" ] && [ "$before" = "$asg" ] && ok "Zuteilung unverändert: $asg" || bad "Zuteilung geändert: $before -> $asg"

echo "14) Verrät der Zustand nach mehreren Zügen weiterhin nichts?"
drawn_all=$(rpc wichtel_state "{\"p_round_id\":\"$rid\"}")
echo "$drawn_all" | grep -qi 'assignment' && bad "Zustand verrät Zuteilung" || ok "Zustand bleibt ohne Zuteilung"

echo
if [ "$fail" = "0" ]; then
  echo "ERGEBNIS: alle Prüfungen grün"
else
  echo "ERGEBNIS: Fehler oben"
fi
echo "Testrunde: $rid"
exit "$fail"
