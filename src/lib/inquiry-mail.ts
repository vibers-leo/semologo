import nodemailer from 'nodemailer';
import {trafficDb} from './traffic-db';
import {deliverInquiry} from './inquiry-mail.mjs';
export async function notifyInquiry(id:string){return deliverInquiry(trafficDb(),nodemailer.createTransport,process.env,id);}
