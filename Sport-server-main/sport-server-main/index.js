require('dotenv').config()
const express=require('express');
const cors=require('cors');
const jwt=require('jsonwebtoken');
const stripe=require('stripe')(process.env.PAYMET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port=process.env.PORT || 5000;
const app=express()
//middleware
app.use(express.json());
app.use(cors());
// jwt
const verifyJWT=(req,res,next)=>{
  const authorization=req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error:true,message:'unauthorized access'})
  }
  const token=authorization.split(' ')[1];

jwt.verify(token,process.env.JWT_TOKEN,(err,decoded)=>{
  if (err) {
    return res.status(403).send({error:true,message:'expired access'})
  }
  req.decoded=decoded;
  next()
}) 
 
}
// basic get  method---start
app.get('/',(req,res)=>{
  res.send('Server is OK Dude.....')
})
app.listen(port,()=>{
  console.log(`Server port is : ${port}`)
})

//database


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER}@cluster0.rgn917b.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    
     client.connect();
    // Send a ping to confirm a successful connection
  // collections
  const usersCollection=client.db('cs-db').collection('users')
  const classesCollection=client.db('cs-db').collection('classes')
  const classCartCollection=client.db('cs-db').collection('classcart')
  const paymentCollection=client.db('cs-db').collection('paymentcart')
// jwt post

app.post('/jwt',(req,res)=>{
  const user=req.body;
  const token=jwt.sign(user,process.env.JWT_TOKEN,
    {expiresIn: '3h'});
    res.send({token})
})

// admin 
const verifyAdmin=async (req,res,next)=>{
  const email =req.decoded.email;
  const  query={email: email};
  const user =  await usersCollection.findOne(query);
  if ( user?.role !== 'admin') {
    return res.status(403).send({error:true,message:'forbidden message'})
  }
  next();
}
// payment
app.post("/create-payment-intent", async (req, res) => {
  const  {price}  = req.body;
const amount=parseInt((price*100).toFixed(2));

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_types: ['card']
  })
 return res.send({
    clientSecret: paymentIntent.client_secret,
  });
});
//  
app.post('/payment', async(req, res) =>{
  const payment = req.body;
  const insertResult = await paymentCollection.insertOne(payment);

  const query = {_id: { $in: payment.cartItems.map(id => new ObjectId(id)) }}
  const deleteResult = await classCartCollection.deleteMany(query)

  res.send({ insertResult, deleteResult});
})










app.get('/payment',async (req,res)=>{
  const result=await paymentCollection.find().toArray();
  res.send(result);
})
// admin email get
app.get('/users/admin/:email', async(req,res)=>{
  const email =req.params.email;
  const query={email: email};
  const user =  await usersCollection.findOne(query);
  const result = { role: user?.role };
  // console.log( result);
  res.send(result)
})
//user patch
app.patch('/users/admin/:id', async (req,res)=>{
  const id=req.params.id;
  const filter={_id: new ObjectId(id)};
 
  const updateDoc={
    $set: {
      role: 'admin'
    },
  }
  const result=await usersCollection.updateOne(filter,updateDoc);
  res.send(result)
})
app.patch('/users/instructor/:id', async (req,res)=>{
  const id=req.params.id;
  const filter={_id: new ObjectId(id)};

  const updateDoc={
    $set: {
      role: 'instructor'
    },
  }
  const result=await usersCollection.updateOne(filter,updateDoc);
  res.send(result)
})

// user post
app.post('/users', async(req,res)=>{
  const user =req.body;
  // console.log(user);
  const query={email: user.email}
  const existUser=await usersCollection.findOne(query);
 
  if (existUser) {
    return res.send({message: 'User already exists'})
  }
  const result=await usersCollection.insertOne(user)
  res.send(result)
})
// user get
app.get('/users', async (req, res) => {

  
  const result = await usersCollection.find().toArray();
 return res.send(result);
});

// decrease
app.patch('/classes/dec/:classId', async (req, res) => {
  try{
  const id = req.params.classId;
  // console.log(id);
  const filter = { _id: new ObjectId(id) };
  const {seat}= req.body;
  // console.log(req.body);
  const updateDoc = {
    $set: {seat: seat}
  };

  
    const result = await classesCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});
// increase
//clases get
app.get('/classes',  async (req,res)=>{
  const result =await classesCollection.find().toArray();
  res.send(result);
})
// //cla
// app.get('/classes/:classId',async (req,res)=>{
//   const id = req.params.classId;
//   const filter = { _id: new ObjectId(id) };
//   const result =await classesCollection.find(filter).toArray();
//   res.send(result);
// })
// app.patch('/classes/inc/:classId', async (req, res) => {
//   const id = req.params.classId;
//   const filter = { _id: new ObjectId(id) };

//   const updateDoc = {
//     $set: req.body
//   };

//   try {
//     const result = await classesCollection.updateOne(filter, updateDoc);
//     res.send(result);
//   } catch (error) {
//     console.error('Error updating class:', error);
//     res.status(500).json({ error: 'Failed to update class' });
//   }
// });






app.get('/classes/:email',async (req,res)=>{
  const email=req.params.email;
  // console.log(email);
const filter={instructor_email: email}
  const result =await classesCollection.find(filter).toArray();
  res.send(result);
})
// classes post
app.post('/classes', async (req,res)=>{
  const  classInfo =req.body;
  const result=await classesCollection.insertOne(classInfo);
  res.send(result);
})
// classes patch
// app.patch('/classes', async (req,res)=>{
//   const  classInfo =req.body;
//   const result=await classesCollection.insertOne(classInfo);
//   res.send(result);
// })
app.patch('/classes/feedback/:id', async (req,res)=>{
  const id=req.params.id;
  const feedback=req.body.feedback
  // console.log(id);
  const filter={_id: new ObjectId(id)};
  // console.log(filter);
  const stausIdentify= await classesCollection.findOne(filter);
  // console.log(stausIdentify);

    const updateDoc={
      $set: {
        feedback: feedback
      },
    }
    const result=await classesCollection.updateOne(filter,updateDoc);
 console.log(result);
   return res.send(result)
  
 


})
app.patch('/classes/approve/:id', async (req,res)=>{
  const id=req.params.id;
  // console.log(id);
  const filter={_id: new ObjectId(id)};
  // console.log(filter);
  const stausIdentify= await classesCollection.findOne(filter);
  // console.log(stausIdentify);
  if (stausIdentify.status ==='pending') {
    const updateDoc={
      $set: {
        status: 'approved'
      },
    }
    const result=await classesCollection.updateOne(filter,updateDoc);
 console.log(result);
   return res.send(result)
  }
 


})
app.patch('/classes/denied/:id', async (req,res)=>{
  const id=req.params.id;
  // console.log(id);
  const filter={_id: new ObjectId(id)};
  // console.log(filter);
  const stausIdentify= await classesCollection.findOne(filter);
  // console.log(stausIdentify);
  if (stausIdentify.status ==='pending') {
    const updateDoc={
      $set: {
        status: 'denied'
      },
    }
    const result=await classesCollection.updateOne(filter,updateDoc);
 console.log(result);
   return res.send(result)
  }
 


})
// class cart
app.post('/classcart', async (req,res)=>{
const classes=req.body;
const result=await classCartCollection.insertOne(classes);
res.send(result)

})
// class cart get
app.get('/classcart', async (req, res) => {
  const userEmail = req.query.email; 
  const result = await classCartCollection.find({ email: userEmail }).toArray();
  res.send(result);
});
// classc cart remove
app.delete('/classcart/:id',async (req,res)=>{
   const classId = req.params.id;
   const query={_id: new ObjectId(classId)};
   const result=await classCartCollection.deleteOne(query);
   res.send(result);
})

//instructors get
app.get('/instructors',async (req,res)=>{
  const filter={role: 'instructor'}
  const result =await usersCollection.find(filter).toArray();
return  res.send(result);
})
   
 await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
