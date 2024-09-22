# oracle-engine-graphql

The GraphQL API for interacting with the oracle engine. Communicates with LangChain, as well as other configured AI clients to provide content generation.

## Installation

This application uses (Bun)[bun.sh] as the runtime instead of node. Ensure that you have the latest version of Bun installed so that you can run the application.

When Bun is installed, you can install the application using `bun install` this will install all dependencies. Once that is complete, you will need to setup some environment variables, I personally use a `.env` file to manage this.

```bash
# .env
# The OpenAI API Key used to talk to the OpenAI API
OPENAI_API_KEY=ASDF1234
# The Web API Key tied to your Firebase project
FIREBASE_WEB_API_KEY=ASDFWER
# The Credentials JSON file exported from Firebase
GOOGLE_APPLICATION_CREDENTIALS="credentials.json"
# The MongoDB Connection string to use for the app
DATABASE_URL="mongodb://localhost:27017/OracleEngine?retryWrites=true&w=majority"
```

This application uses many different APIs to operate. Firebase, OpenAI, MongoDB, etc... In order for this application to run, you will need to provide the proper credentials in the environment file.

## Setting up the DB

This application uses (Prisma)[prisma.io] to talk to MongoDB Atlas. This is done by using the `DATABASE_URL` environment variable to establish a connection string. Once the `DATABASE_URL` is provided, run `bunx prisma generate` to generate the necessary type definitions locally. This will set you up for local development.

If you are initializing a new DB, then you will instead want to run `bunx prisma db push`. This will update the DB configured in `DATABASE_URL` with the structure defined in the Prisma Schema, and it will generate the type definitions. If you make any changes to the schema, this command should be run to update the DB appropriately.

## Running the application

To run the application, use `bun run dev`. This will launch the GraphQL server on (http://localhost:4000/graphql)[(http://localhost:4000/graphql]. From there, you will need to login to get an Authorization Header to use for subsequent requests.

**Login**

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
  }
}
```

```js
{
    "variables": {
        "input": {
            "email": "your@email",
            "password": "your@password"
        }
    }
}
```

This should return a response with a token. That token can be appended to requests using the `Authorization: "Bearer {{token}}"` header. You can verify you are logged in using the following query:

**Current User**

```graphql
query CurrentUser {
  currentUser {
    id
  }
}
```

You should now be able to make requests normally against the API. Tokens do not last forever, and you may need to login again if your calls begin failing.
