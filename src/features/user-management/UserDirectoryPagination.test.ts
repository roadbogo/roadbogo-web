import {describe,expect,it} from "vitest";
import {getUserPaginationItems,USER_PAGE_SIZE_OPTIONS} from "./UserDirectoryPagination";

describe("user directory pagination",()=>{
 it("shows every page when the result has five pages or fewer",()=>{
  expect(getUserPaginationItems(1,3)).toEqual([1,2,3]);
  expect(getUserPaginationItems(3,5)).toEqual([1,2,3,4,5]);
 });
 it("uses stable edge pages and ellipses only for larger results",()=>{
  expect(getUserPaginationItems(1,8)).toEqual([1,2,"ellipsis",8]);
  expect(getUserPaginationItems(4,8)).toEqual([1,"ellipsis",3,4,5,"ellipsis",8]);
  expect(getUserPaginationItems(8,8)).toEqual([1,"ellipsis",7,8]);
 });
 it("keeps the supported page sizes aligned with the directory contract",()=>{
  expect(USER_PAGE_SIZE_OPTIONS).toEqual([10,20,50]);
 });
});
