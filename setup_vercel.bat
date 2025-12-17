@echo off
cd "c:\Users\Josep Calafat\Documents\GitHub\platform"
echo bookfast > vercel_input.txt
echo platform >> vercel_input.txt
type vercel_input.txt | vercel link --yes
del vercel_input.txt
vercel env pull --yes
