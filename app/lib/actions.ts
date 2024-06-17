'use server'
import { sql } from '@vercel/postgres'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { date, z } from 'zod'
import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import bcrypt from 'bcrypt'

//todas las funciones bajo 'use server' se ejecutan en el servidor y no son accesibles por el cliente.

//validacion usando zod
const TransactionSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  value: z.coerce.number(),
  tokens: z.coerce.number(),
  vault: z.string(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
})

const UserSchema = z.object({ 
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(4),
  customerId: z.string().optional(), 
})

const CustomerSchema = z.object({
  id: z.string(),
  name: z.string().min(4),
  email: z.string().email().optional(),
  image_url: z.string().optional(),
})

const tokenPriceSchema = z.object({
  price: z.coerce.number(),
  tokenname: z.string(),
  date: z.string()
}) 

//omitir id que no viene en form
const FormTransactionSchema = TransactionSchema.omit({ id: true })
const FormCustomerSchema = CustomerSchema.omit({ id: true })
export async function createTransaction(formData: FormData) {
  
  const allFormData = Object.fromEntries(formData.entries()) //todos los datos del formulario
  const { customerId, value, tokens, vault, status, date } = FormTransactionSchema.parse(allFormData) //data validadada
  //formatear fecha, el 2do elemento del split es la hora. en la base de datos formato (mm/dd/yyyy)
  const dateFormatted = new Date(date).toISOString().split('T')[0] 
  try {
    //subir a DB
    await sql
      `INSERT INTO transactions (customerid, value, tokens, vault, status, date) 
      VALUES (${customerId}, ${value}, ${tokens}, ${vault}, ${status}, ${dateFormatted})` 
  } catch (error) {
    console.log(error)
    return {
      message: 'Database Error: Failed to Create Transaction.',
    }
  }
  revalidatePath('/dashboard/transactions') //revalidar para que no use datos de cache
  redirect('/dashboard/transactions')
}

export async function updateTransaction(id: string, formData: FormData) {
  const allUpdateData = Object.fromEntries(formData)
  const { customerId, value, tokens, vault, status, date } = FormTransactionSchema.parse(allUpdateData)  
  const dateFormatted = new Date(date).toISOString().split('T')[0]

  try {
    await sql`
      UPDATE transactions
      SET customerid = ${customerId}, value = ${value}, tokens = ${tokens}, vault = ${vault}, status = ${status}, date = ${dateFormatted}
      WHERE id = ${id} `
  } catch (error) {
    return { message: 'Database Error: Failed to Update Transaction.' }
  }

  revalidatePath('/dashboard/transactions')
  redirect('/dashboard/transactions')
}

export async function deleteTransaction(id: string) {
  try {
    await sql`DELETE FROM transactions WHERE id = ${id}`
  } catch (error) {
    console.log(error)
    return { message: 'Database Error: Failed to Delete Transaction.' }
  }
  revalidatePath('/dashboard/transactions')
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData)
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.'
        default:
          return 'Something went wrong.'
      }
    }
    throw error
  }
}

export async function register(formData: FormData) {
  const allData = Object.fromEntries(formData)
  const { email, username, password } = UserSchema.parse(allData)
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    await sql `INSERT INTO users (email, name, password) VALUES (${email}, ${username}, ${hashedPassword})`
  } catch (error) {
    console.log(error)
  }
  revalidatePath('/login')
  redirect('/login')
}

export async function createCustomer(formData: FormData) {

  const rawData = {
    name: formData.get('name'),
    email: formData.get('email') ,
    image_url: formData.get('image_url') ,
  }

  const { name, email, image_url } = FormCustomerSchema.parse(rawData) //data validadada
  
  try {
    //subir a DB
    await sql
      `INSERT INTO customers ( name, email, image_url)
      VALUES (${name}, ${email}, ${image_url})`
  } catch (error) {
    console.log(error)
    return {
      message: 'Database Error: Failed to Create User.',
    }
  }
  revalidatePath('/dashboard/customers') //revalidar para que no use datos de cache
  redirect('/dashboard/customers')
}

export async function deleteCustomer(id: string) {
  try {
    await sql`DELETE FROM customers WHERE id = ${id}`
  } catch (error) {
    console.log(error)
    return { message: 'Database Error: Failed to Delete customer.' }
  }
  revalidatePath('/dashboard/customers')
}

export async function updateCustomer(id: string, formData: FormData) {
  const allUpdateData = Object.fromEntries(formData)
  const { name, email, image_url } = FormCustomerSchema.parse(allUpdateData)

  try {
    await sql`
      UPDATE customers
      SET name = ${name}, email = ${email}, image_url = ${image_url}
      WHERE id = ${id} `
  } catch (error) {
    return { message: 'Database Error: Failed to Update Customer.' }
  }

  revalidatePath('/dashboard/customers')
  redirect('/dashboard/customers')
}

export async function createTokenPrice(formData: FormData) {

  const allFormData = Object.fromEntries(formData.entries()) //todos los datos del formulario
  const { date, price, tokenname } = tokenPriceSchema.parse(allFormData) //data validadada
  // const date = new Date().toISOString().split('T')[0] //agregar hora automatico, el 2do elemento es la hora

  try {
    await sql
      `INSERT INTO tokenprices (date, tokenname, price)
      VALUES (${date}, ${tokenname}, ${price})`
  } catch (error) {
    console.log(error)
    return {
      message: 'Database Error: Failed to Create token price.',
    }
  }
  revalidatePath('/dashboard/funds') //revalidar para que no use datos de cache
  // redirect('/dashboard/transactions')
}

export async function deletePriceWithId(id: string) {
  try {
    await sql`DELETE FROM tokenprices WHERE id = ${id}`
  } catch (error) {
    console.log(error)
    return { message: 'Database Error: Failed to Delete token price.' }
  }
  revalidatePath('/dashboard/funds')
}