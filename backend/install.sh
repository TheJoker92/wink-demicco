#installation node packages
npm install dotenv
npm install --save-dev @types/node

npm install -D tsx
npm install mongodb

#initialize db
node --experimental-strip-types utils/initdb.ts 