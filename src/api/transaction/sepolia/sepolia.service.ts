import { SepoliaRepository } from "./sepolia.repository";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SepoliaService {
  constructor(private readonly sepoliaRepository: SepoliaRepository) {}

}