import { Repository } from 'typeorm';
import { CustomRepository } from "../typeorm-ex.decorator";
import { Sepolia } from "./sepolia";


@CustomRepository(Sepolia)
export class SepoliaRepository extends Repository<Sepolia> {}