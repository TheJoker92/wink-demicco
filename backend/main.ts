import * as constant from './utils/const.ts'

import express from 'express';

import * as postsRouter from './post/route.ts'

const app = express()


app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use("/post", postsRouter.default);


app.listen(constant.port, () => {
  console.log(`Example app listening on port ${constant.port}`)
})