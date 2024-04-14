'use server'
import { sql } from '@vercel/postgres'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import bcrypt from 'bcrypt'

//todas las funciones bajo 'use server' se ejecutan en el servidor y no son accesibles por el cliente.

//validacion usando zod
const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
})

const MovementSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  value: z.coerce.number(),
  tokens: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
}) 

//omitimos el id y la fecha que no vienen en el form
const InvoiceFormSchema = InvoiceSchema.omit({ id: true, date: true })
export async function createInvoice(formData: FormData) {
  // const allFormData = Object.fromEntries(formData.entries()) //todos los datos del formulario
  const rawFormData = {
    customerId: formData.get('customerId'), //names de los campos del formulario
    amount: formData.get('amount'),
    status: formData.get('status'),
  }
  const { customerId, amount, status } = InvoiceFormSchema.parse(rawFormData) //data validadada
  const amountInCents = amount * 100
  const date = new Date().toISOString().split('T')[0] //el 2do elemento es la hora

  try {
    //subir a DB
    await sql
      `INSERT INTO invoices (customer_id, amount, status, date) 
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})`
  } catch (error) {
    console.log(error)
    return {
      message: 'Database Error: Failed to Create Invoice.',
    }
  }
  revalidatePath('/dashboard/invoices') //revalidar para que no use datos de cache
  redirect('/dashboard/invoices')
}

const FormMovementSchema = MovementSchema.omit({ id: true })
export async function createMovement(formData: FormData) {
  const allFormData = Object.fromEntries(formData.entries()) //todos los datos del formulario

  const { customerId, value, tokens, status, date } = FormMovementSchema.parse(allFormData) //data validadada
  // const date = new Date().toISOString().split('T')[0] //el 2do elemento es la hora

  try {
    //subir a DB
    await sql
      `INSERT INTO movements (customer_id, value, tokens, status, date)
      VALUES (${customerId}, ${value}, ${tokens}, ${status}, ${date})`
  } catch (error) {
    console.log(error)
    return {
      message: 'Database Error: Failed to Create Invoice.',
    }
  }
  revalidatePath('/dashboard/invoices') //revalidar para que no use datos de cache
  redirect('/dashboard/invoices')
}

const UpdateInvoice = InvoiceSchema.omit({ id: true, date: true, })
export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({ //extract data and validate with zod-parse
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  })
  const amountInCents = amount * 100

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id} `
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' }
  }

  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')
}

export async function updateMovement(id: string, formData: FormData) {
  const allUpdateData = Object.fromEntries(formData)
  const { customerId, value, tokens, status, date } = FormMovementSchema.parse(allUpdateData)  
  
  try {
    await sql`
      UPDATE movements
      SET customer_id = ${customerId}, value = ${value}, tokens = ${tokens}, status = ${status}, date = ${date}
      WHERE id = ${id} `
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' }
  }

  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`
  } catch (error) {
    console.log(error)
    return { message: 'Database Error: Failed to Delete Invoice.' }
  }
  revalidatePath('/dashboard/invoices')
}

export async function deleteMovement(id: string) {
  try {
    await sql`DELETE FROM movements WHERE id = ${id}`
  } catch (error) {
    console.log(error)
    return { message: 'Database Error: Failed to Delete Invoice.' }
  }
  revalidatePath('/dashboard/invoices')
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

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(4),
})
export async function register(formData: FormData) {
  const allData = Object.fromEntries(formData)
  const { email, username, password } = RegisterSchema.parse(allData)
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    await sql `INSERT INTO users (email, name, password) VALUES (${email}, ${username}, ${hashedPassword})`
  } catch (error) {
    console.log(error)
  }
  revalidatePath('/login')
  redirect('/login')
}