
OBS! Detta dokument existerar endast temporärt, fram tills dess att ett snyggare och mer detaljerat dokument har tagits fram.




**Inloggning/anslutning**

Koder genereras i terminalen som överlever i en 'session', dvs. så länge som servern lever. Server-admin väljer antalet koder som ska genereras. Access.txt skapas med ‘utklippsvänliga’ remsor med en kod på varje rad. Deltagarna får varsin kod på en lapp. Koder nollställs alltså varje gång man stänger av servern (funktionalitet för att återskapa koder från Access.txt borde införas ifall servern krashar osv.).

Koden skrivs in av användaren och om den är giltig skickas användaren vidare till vote.ejs. Routes är kodat så att du inte kan komma åt vote.ejs utan att ha passerat authentiseringen. Varje post-request av webläsaren kräver att access-koden skickas med som parameter för att jämföra mot de genererade koderna.

Koden kommer ej att kunna hackas då koden kan ha 5610 = 3,03305489e17 kombinationer. Om vi antar att en klient kan göra 1 försök per ns (vilket är extremt optimistiskt) så krävs det 9 år 225 dagar, 11 timmar, 31 minuter och 29 seconds för att prova alla koder.

Det kommer inte att behövas databas, registrering eller identifiering av deltagare då accesskoder används. 

- Om någon hämtar en kod och skickar online till någon annan?
	-- Skulle likväl kunnat fråga: ‘Vad vill du att jag röstar på?’ till någon utanför mötet i dagsläget.

- Om någon har vote.ejs i cache-minnet och skickar svar på frågan ändå?
	-- Kräver att användaren har en giltig accesskod som parameter i varje post-request.

- Om någon utomstående försöker bevaka frågorna?
	-- Måste passera inloggningen för att se votes.ejs.


**Enheter**

Eftersom det handlar om HTML, CSS och JS på frontend kan applikationen köras på dator, telefon, surfplatta etc.

- Måste inte sektionen erbjuda ett alternativ till de som inte har en dator,tele etc.?
	-- Man skulle kunna äska om 2-3 surfplattor á tusenlappen som kan lånas ut till deltagare utan egen enhet.


**Frågor**

Frågor skapas i server-terminalen av admin. Ges för tillfället följande parametrar: frågan, de olika svaren, antal svar som krävs, vakant enabled och blank enabled.Man kan alltså återskapa alla tänkbara frågor som uppkommer: “Kan vi rösta in x som mötesordförande?”, “Vilka fem vill vi ha i föreningen x?” etc. Frågorna skickas till klienterna i realtid via sockets. Dvs. samma verktyg som används i chatrum mm.


**Resultat**

Frågornas resultat är endast synliga för server-admin. Klienter får texten “Väntar på nästa fråga…” när de har svarat. Admins kan ej se vem som har svarat vad, eftersom man aldrig registrerar vem som tar vilken kod => alla svar är anonyma, men garanterade att det är en mötesdeltagare! Resutlaten rapporteras som antal röster på respektive svar samt procentuellt av totala antalet röster => enkelt att snabbt avläsa resultat.


**Integritet**

- Om man registerar svar på datorn ser folk runt om kring vad man svarar?
	-- Svar registreras med tangenterna 1-9, dvs. du kan svara på något utan att folk runtom ser. Visuell feedback ges när svar registreras och det går att se hur många svar man har gett. Om man blir osäker trycker man på knappen för att se vad man har svarat. Det går även att nollställa svaren.

	Vill man göra det ännu bättre kan man slumpa ordningen på hur svaren presenteras i varje klient. Så att även om någon ser att man klickar på ‘någon knapp i mitten’ så innebär det inte att det kan handla om samma svar som på ens egna dator.


**Säkerthet - frontend**

- Vad händer om någon ger sig in i frontend-JS och pillar?
	-- Du kan aldrig komma åt vote.ejs utan en giltig kod eftersom servern vägrar skicka ut den filen utan rätt access. Så man kan inte hacka sig förbi och komma åt frågorna.

	Även om du går förbi kontroller som tex. ser till att du har lämnat tillräckligt många svar kommer du få ett Error-response från servern om du gör post-requests, eftersom servern gör exakt samma kontroller.

	Alla sätt att försöka förstöra eller trolla innebär endast att du påverkar din egna klient, vilket gör att endast din egna röst blir konstig. Det är samma sak som om någon skulle trolla när de skriver en fysisk lapp.


**Säkerthet - backend**

- Vad händer om folk ddosar?
	-- NodeJS stänger automatiskt av en IP om en klient skickar för många post-/get-requests på en kort tid.

	TooBusy.js ser till att servern nekar all trafik istället för att krascha - om många olika IPS skickar ddos.

	Man skulle kunna implementera så att alla datorer som vill ansluta måste ha en lokal ipadress.

- Vad händer om folk utnyttjar andra säkerhetskryphål?
	En enkel kontroll som ex. 'if(accessCodes.contains(code))'' kan i praktiken inte gå fel (om man inte har hackat server-datorn och förändrat källkoden).

	Allt ansvar om säkerhet är upp till NodeJS att hantera. NodeJS är väl etablerat, open source etc. så det ska inte vara ett problem.


**Kodsäkerhet**

styrIT borde bjuda in folk till att ha en workshop där man grundligt går igenom all kod samt försöker hitta sätt att förstöra servern.


**Övriga problem**

- Hur kan sektionsmötet lita på att resultatet inte är fifflat med?
	-- All kod skickas upp på github. Alla får en guide utskickad till sig med liknande information som i det här dokumentet - långt innan mötet. Alla uppmanas att läsa koden på git.

	Under mötet väljer man in två oberoende/slumpade kontrollanter istället för rösträknare. Dessa placerar man tillsammans med ansvarig serveradmin i styrIT där framme. Kontrollanterna får sedan titta på när admin gör en clone från git, återskapar koderna som delats ut och startar servern. Under hela mötet får kontrollanterna sedan sitta jämte admin och bevaka så mycket/lite de vill. (Kontrollanter + admin behöver inte sitta där framme, utan bara bredvid varandra, så att kontrollanterna fortfarande kan delta i mötet). Om man inte litar på att admins dator inte är fifflad med ber man om att köra servern ifrån godtycklig annan dator.

	Man inför dessutom en regel som innebär att om en deltagare, efter att fått höra ett resultat i en fråga, misstänker fusk - har hen rätt att begära en analog votering.


- Det låter komplicerat för en förvirrad deltagare?
	-- Varje möte bör inledas med 5 min introduktion till röstsystemet. Ett dokument bör sammanställas i god tid innan mötet, och skickas ut inför alla framtida möten, med all information gällande röstsystemet.